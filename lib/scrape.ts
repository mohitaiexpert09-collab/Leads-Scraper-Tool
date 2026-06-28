import "server-only";
import { normalizeBatch, type NormalizedLead } from "./normalize";
import { getSupabaseAdmin } from "./supabase/admin";
import { hasAirtable, syncLeadToAirtable } from "./airtable";
import {
  NICHE_QUERIES,
  SHOPIFY_QUERIES,
  pickAdvertisers,
  pagesToRaw,
  shopifyToRaw,
  onlyReachable,
  type AdItem,
  type PageItem,
  type ShopifyStore,
} from "./scrape-filters";

export { NICHE_QUERIES, SHOPIFY_QUERIES };

/**
 * Automated scrape pipeline (buying-intent, easily-reachable leads):
 *   1) Facebook/Meta Ad Library -> small Indian D2C brands CURRENTLY running ads
 *   2) filter out marketplaces / big-funded brands -> founder-led advertiser pages
 *   3) Facebook Pages scraper   -> WhatsApp, phone, email, website, followers
 *   4) keep only reachable leads -> normalize + Tier 1-4 score + store (service role)
 *
 * Long Apify runs exceed serverless limits, so runs start ASYNC with an Apify
 * webhook that calls /api/scrape/hook when each stage finishes.
 */

const APIFY = "https://api.apify.com/v2";
export const AD_LIBRARY_ACTOR = "automation-lab~facebook-ads-library";
export const PAGES_ACTOR = "apify~facebook-pages-scraper";
export const SHOPIFY_ACTOR = "clearpath~shopify-store-leads";

// Stores to pull per niche keyword. ~11 keywords × this ≈ enough raw to net ~100
// reachable, deduped Shopify leads/day.
const SHOPIFY_PER_QUERY = 12;

function token(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new Error("APIFY_TOKEN is not set.");
  return t;
}

export interface StartedRun {
  runId: string;
  datasetId: string;
}

/** Start an Apify actor run asynchronously, optionally with a success webhook. */
export async function startRun(
  actorId: string,
  input: Record<string, unknown>,
  webhookUrl?: string
): Promise<StartedRun> {
  let url = `${APIFY}/acts/${actorId}/runs?token=${token()}`;
  if (webhookUrl) {
    const webhooks = [{ eventTypes: ["ACTOR.RUN.SUCCEEDED"], requestUrl: webhookUrl }];
    url += `&webhooks=${Buffer.from(JSON.stringify(webhooks)).toString("base64")}`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Apify start ${actorId} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return { runId: json.data.id, datasetId: json.data.defaultDatasetId };
}

/** Fetch dataset items (clean). */
export async function fetchDataset(datasetId: string, limit = 1000): Promise<Record<string, any>[]> {
  const res = await fetch(`${APIFY}/datasets/${datasetId}/items?token=${token()}&clean=true&limit=${limit}`);
  if (!res.ok) throw new Error(`Apify dataset ${datasetId} fetch failed (${res.status})`);
  return (await res.json()) as Record<string, any>[];
}

/* ---------------- storage ---------------- */

export async function storeLeads(leads: NormalizedLead[]): Promise<{ inserted: number; duplicates: number }> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set — automated storage needs it.");
  if (!leads.length) return { inserted: 0, duplicates: 0 };

  const keys = leads.map((l) => l.dedupe_key);
  const { data: existing } = await admin.from("leads").select("dedupe_key").in("dedupe_key", keys);
  const have = new Set((existing ?? []).map((r: { dedupe_key: string }) => r.dedupe_key));
  const fresh = leads.filter((l) => !have.has(l.dedupe_key));
  if (fresh.length) {
    const { data: rows, error } = await admin
      .from("leads")
      .insert(fresh.map((l) => ({ ...l, status: "new" })))
      .select("*");
    if (error) throw new Error(error.message);
    // Mirror the freshly inserted leads into Airtable (best-effort).
    if (hasAirtable() && rows) {
      for (const row of rows) await syncLeadToAirtable(row as Parameters<typeof syncLeadToAirtable>[0]);
    }
  }
  return { inserted: fresh.length, duplicates: leads.length - fresh.length };
}

function leadsFromPages(pages: PageItem[]): NormalizedLead[] {
  const normalized = normalizeBatch(pagesToRaw(pages), "facebook");
  return onlyReachable(normalized); // easily-reachable only
}

async function logRun(fields: Record<string, unknown>): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin.from("scrape_runs").insert(fields).select("id").maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function updateRun(id: string | null, fields: Record<string, unknown>) {
  if (!id) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin.from("scrape_runs").update(fields).eq("id", id);
}

/* ---------------- orchestration ---------------- */

function hookUrl(stage: string, runRow: string, extra?: Record<string, string>): string {
  let base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "http://localhost:3000";
  // Apify requires a fully-qualified URL; tolerate a site URL entered without a scheme.
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  const secret = process.env.CRON_SECRET || "";
  let url = `${base}/api/scrape/hook?stage=${stage}&run=${runRow}&secret=${encodeURIComponent(secret)}`;
  for (const [k, v] of Object.entries(extra ?? {})) url += `&${k}=${encodeURIComponent(v)}`;
  return url;
}

/* ---------------- Shopify source (primary volume) ---------------- */

/** Start one async Shopify discovery run per niche keyword (webhook-driven). */
export async function startShopify(queries: string[] = SHOPIFY_QUERIES, perQuery = SHOPIFY_PER_QUERY): Promise<void> {
  for (const q of queries) {
    const runRow = await logRun({ source: "shopify", actor_id: SHOPIFY_ACTOR, status: "running", params: { query: q, perQuery } });
    await startRun(
      SHOPIFY_ACTOR,
      { query: q, shipsTo: "IN", maxItems: perQuery },
      hookUrl("shopify", runRow ?? "", { cat: q })
    );
  }
}

/** Stage (webhook): Shopify run finished -> map -> normalize -> reachable -> store. */
export async function handleShopifyStage(
  datasetId: string,
  runRow: string,
  category?: string
): Promise<{ inserted: number; duplicates: number }> {
  const stores = await fetchDataset(datasetId);
  const leads = onlyReachable(normalizeBatch(shopifyToRaw(stores as ShopifyStore[], category), "shopify"));
  const result = await storeLeads(leads);
  await updateRun(runRow, { status: "completed", leads_found: result.inserted });
  return result;
}

// Volume targets for ~100 reachable leads/day. Not every advertiser page yields a
// reachable lead (some have no public phone/WhatsApp/email), so we over-fetch ads
// and enrich a wider set of advertiser pages, then keep only the reachable ones.
const DAILY_MAX_ADS = 300; // ad-library items to pull across all niche queries
const DAILY_ADVERTISER_CAP = 200; // advertiser pages to enrich via the Pages scraper

/**
 * Kick off the full daily scrape: Shopify (primary volume, many small runs) AND
 * the Facebook Ad-Library path (supplementary, ad-running brands). Both are async
 * and store via webhooks; dedupe-by-key merges the two sources.
 */
export async function startScrape(queries: string[] = NICHE_QUERIES, maxAds = DAILY_MAX_ADS): Promise<{ runRow: string | null }> {
  await startShopify();
  const runRow = await logRun({ source: "facebook", actor_id: AD_LIBRARY_ACTOR, status: "running", params: { queries, maxAds } });
  await startRun(
    AD_LIBRARY_ACTOR,
    { searchQueries: queries, country: "IN", activeStatus: "active", maxAds },
    hookUrl("ads", runRow ?? "")
  );
  return { runRow };
}

/** Stage 1 (webhook): ads finished -> filter -> start Pages enrichment run. */
export async function handleAdsStage(datasetId: string, runRow: string) {
  const ads = await fetchDataset(datasetId);
  const pageUrls = pickAdvertisers(ads as AdItem[], DAILY_ADVERTISER_CAP);
  await updateRun(runRow, { params: { advertisers: pageUrls.length } });
  if (!pageUrls.length) {
    await updateRun(runRow, { status: "completed", leads_found: 0 });
    return;
  }
  await startRun(PAGES_ACTOR, { startUrls: pageUrls.map((url) => ({ url })) }, hookUrl("pages", runRow));
}

/** Stage 2 (webhook): pages finished -> normalize + score + store. */
export async function handlePagesStage(datasetId: string, runRow: string): Promise<{ inserted: number; duplicates: number }> {
  const pages = await fetchDataset(datasetId);
  const result = await storeLeads(leadsFromPages(pages as PageItem[]));
  await updateRun(runRow, { status: "completed", leads_found: result.inserted });
  return result;
}

/** Synchronous full pipeline (for local testing / Vercel Pro). Slow (2-4 min). */
export async function runScrapeSync(queries: string[] = NICHE_QUERIES, maxAds = 15) {
  let inserted = 0;
  let duplicates = 0;

  // Shopify (primary): a few niche keywords inline to keep local runs reasonable.
  for (const q of SHOPIFY_QUERIES.slice(0, 3)) {
    const run = await startRun(SHOPIFY_ACTOR, { query: q, shipsTo: "IN", maxItems: 10 });
    await waitForRun(run.runId);
    const leads = onlyReachable(normalizeBatch(shopifyToRaw((await fetchDataset(run.datasetId)) as ShopifyStore[], q), "shopify"));
    const r = await storeLeads(leads);
    inserted += r.inserted;
    duplicates += r.duplicates;
  }

  // Facebook Ad Library (supplementary).
  const adRun = await startRun(AD_LIBRARY_ACTOR, { searchQueries: queries, country: "IN", activeStatus: "active", maxAds });
  await waitForRun(adRun.runId);
  const pageUrls = pickAdvertisers((await fetchDataset(adRun.datasetId)) as AdItem[]);
  if (pageUrls.length) {
    const pagesRun = await startRun(PAGES_ACTOR, { startUrls: pageUrls.map((url) => ({ url })) });
    await waitForRun(pagesRun.runId);
    const r = await storeLeads(leadsFromPages((await fetchDataset(pagesRun.datasetId)) as PageItem[]));
    inserted += r.inserted;
    duplicates += r.duplicates;
  }

  return { inserted, duplicates, advertisers: pageUrls.length };
}

async function waitForRun(runId: string, maxSecs = 280) {
  const deadline = Date.now() + maxSecs * 1000;
  while (Date.now() < deadline) {
    const res = await fetch(`${APIFY}/actor-runs/${runId}?token=${token()}`);
    const status = (await res.json())?.data?.status;
    if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      if (status !== "SUCCEEDED") throw new Error(`Apify run ${runId} ended ${status}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Apify run timed out (sync mode). Use async webhook mode instead.");
}
