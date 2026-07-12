/**
 * Add ~50-100 MEDIUM-SIZE Indian real-estate agency leads (targets for a
 * $50k-$100k sales-CRM pitch). Uses Google Maps across metros with website +
 * contact enrichment, filters out big portals/franchises and dead listings,
 * keeps agencies with a phone + website (email/social where available), then
 * ACCUMULATES them into Supabase + Airtable (does NOT delete existing leads).
 *
 * Budget-safe: the Apify run is started with a hard maxTotalChargeUsd cap.
 *
 * Usage: npx tsx scripts/refresh-realestate-leads.ts
 * Needs in .env.local: APIFY_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   (optional AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { normalizeBatch } from "../lib/normalize";

function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* ignore */
  }
}

const APIFY = "https://api.apify.com/v2";
const GMAPS_ACTOR = "compass~crawler-google-places";
const TARGET = 100;
const MAX_CHARGE_USD = 2.5; // hard budget cap on the run
const PER_SEARCH = 25;

// Metro-targeted searches — where mid-size brokerages that can afford the system are.
const SEARCH_TERMS = [
  "real estate agency Mumbai",
  "real estate agency Gurgaon",
  "real estate agency Bangalore",
  "real estate agency Pune",
  "real estate agency Hyderabad",
  "real estate agency Noida",
  "real estate consultant Delhi",
  "property consultant Chennai",
  "real estate brokerage Ahmedabad",
  "real estate agency Kolkata",
];

const REALESTATE_RE = /real\s?estate|realtor|property|realty|estate agent|properties|brokerage|realtors/i;
// Big portals, aggregators, global franchises and large developers = "too big".
const EXCLUDE_RE =
  /magicbricks|99acres|housing\.com|nobroker|square\s?yards|squareyards|anarock|proptiger|\bjll\b|cbre|knight frank|colliers|cushman|re\/?max|century\s?21|sotheby|keller williams|coldwell|\bdlf\b|lodha|godrej|prestige|brigade|\bsobha\b|puravankara|hiranandani|oberoi realty|\bcredai\b|nobroker|investors clinic|homebazaar/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runGmaps(token: string): Promise<Record<string, any>[]> {
  const input = {
    searchStringsArray: SEARCH_TERMS,
    countryCode: "in",
    language: "en",
    website: "withWebsite",
    scrapeContacts: true,
    maxCrawledPlacesPerSearch: PER_SEARCH,
  };
  console.log(`Starting Google Maps scrape (${SEARCH_TERMS.length} metro searches × ${PER_SEARCH}, cap $${MAX_CHARGE_USD})…`);
  const start = await fetch(`${APIFY}/acts/${GMAPS_ACTOR}/runs?token=${token}&maxTotalChargeUsd=${MAX_CHARGE_USD}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!start.ok) throw new Error(`Apify start failed (${start.status}): ${(await start.text()).slice(0, 200)}`);
  const { data: run } = await start.json();

  const deadline = Date.now() + 9 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(8000);
    const s = await (await fetch(`${APIFY}/actor-runs/${run.id}?token=${token}`)).json();
    const status = s?.data?.status;
    const charge = s?.data?.stats?.computeUnits != null ? "" : "";
    process.stdout.write(`\r  status: ${status} ${charge}   `);
    if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      console.log("");
      break;
    }
  }
  const items = await (
    await fetch(`${APIFY}/datasets/${run.defaultDatasetId}/items?token=${token}&clean=true&limit=2000`)
  ).json();
  return items as Record<string, any>[];
}

/** Medium-size agency keeper: real estate + India + phone + website, not a big brand. */
function isKeeper(p: Record<string, any>): boolean {
  const cc = String(p.countryCode || "").toUpperCase();
  const cat = p.categoryName || "";
  const name = p.title || "";
  const reviews = Number(p.reviewsCount) || 0;
  const hasPhone = Boolean(p.phone && String(p.phone).trim());
  const hasWebsite = Boolean(p.website && String(p.website).trim());
  return (
    cc === "IN" &&
    REALESTATE_RE.test(`${cat} ${name}`) &&
    !EXCLUDE_RE.test(name) &&
    hasPhone &&
    hasWebsite &&
    reviews >= 3 && // skip dead listings
    reviews <= 1500 // skip the giants
  );
}

function toRaw(p: Record<string, any>): Record<string, any> {
  return {
    company: p.title,
    website: p.website || null,
    email: Array.isArray(p.emails) && p.emails.length ? p.emails[0] : null,
    phone: p.phone || p.phoneUnformatted || null,
    whatsapp: p.phone || p.phoneUnformatted || null,
    instagram_url: Array.isArray(p.instagrams) && p.instagrams.length ? p.instagrams[0] : null,
    facebook_url: Array.isArray(p.facebooks) && p.facebooks.length ? p.facebooks[0] : null,
    linkedin_url: Array.isArray(p.linkedIns) && p.linkedIns.length ? p.linkedIns[0] : null,
    followers: null,
    category: p.categoryName || "Real estate agency",
    city: p.city || null,
    ads_running: null,
  };
}

async function airtableAppend(leads: Record<string, any>[]) {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) {
    console.log("Airtable not configured — skipping mirror.");
    return;
  }
  const table = encodeURIComponent(process.env.AIRTABLE_TABLE || "Leads");
  const url = `https://api.airtable.com/v0/${base}/${table}`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  let created = 0;
  for (let i = 0; i < leads.length; i += 10) {
    const batch = leads.slice(i, i + 10).map((l) => ({
      fields: {
        Company: l.company ?? "",
        Tier: l.tier ?? null,
        Score: l.score ?? null,
        Status: "new",
        WhatsApp: l.whatsapp ?? "",
        Phone: l.phone ?? "",
        Email: l.email ?? "",
        Website: l.website ?? "",
        Instagram: l.instagram_url ?? "",
        Facebook: l.facebook_url ?? "",
        City: l.city ?? "",
        Category: l.category ?? "",
        Source: l.source ?? "",
      },
    }));
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ records: batch, typecast: true }) });
    if (res.ok) created += batch.length;
    else if (created === 0) console.error("Airtable insert error:", res.status, (await res.text()).slice(0, 200));
  }
  console.log(`Airtable — appended ${created} real-estate leads.`);
}

async function reportSpend(token: string) {
  try {
    const lim = await (await fetch(`${APIFY}/users/me/limits?token=${token}`)).json();
    console.log(`Apify spend this cycle: $${(lim?.data?.current?.monthlyUsageUsd ?? 0).toFixed(3)} / $${lim?.data?.limits?.maxMonthlyUsageUsd}.`);
  } catch {
    /* ignore */
  }
}

async function main() {
  loadEnv();
  const token = process.env.APIFY_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token) throw new Error("Missing APIFY_TOKEN");
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const places = await runGmaps(token);
  console.log(`Scraped ${places.length} places.`);
  await reportSpend(token);

  const keepers = places.filter(isKeeper).sort((a, b) => (Number(b.reviewsCount) || 0) - (Number(a.reviewsCount) || 0));
  console.log(`${keepers.length} match (medium real-estate agency + phone + website).`);

  const normalized = normalizeBatch(keepers.map(toRaw), "google_maps")
    .filter((l) => (l.phone || l.whatsapp) && l.website)
    .slice(0, TARGET);
  console.log(`Prepared ${normalized.length} unique leads.`);
  if (!normalized.length) throw new Error("No matching agencies found — nothing inserted.");

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const keys = normalized.map((l) => l.dedupe_key);
  const { data: existing } = await admin.from("leads").select("dedupe_key").in("dedupe_key", keys);
  const have = new Set((existing ?? []).map((r: { dedupe_key: string }) => r.dedupe_key));
  const fresh = normalized.filter((l) => !have.has(l.dedupe_key));

  if (fresh.length) {
    const { error } = await admin.from("leads").insert(fresh.map((l) => ({ ...l, status: "new" })));
    if (error) throw new Error("Insert failed: " + error.message);
  }
  const { count: total } = await admin.from("leads").select("id", { count: "exact", head: true });
  console.log(`Inserted ${fresh.length} new real-estate leads (skipped ${normalized.length - fresh.length} dupes). Total leads now: ${total ?? "?"}.`);

  const withEmail = fresh.filter((l) => l.email).length;
  const withSocial = fresh.filter((l) => l.instagram_url || l.facebook_url || l.linkedin_url).length;
  console.log(`Coverage — phone ${fresh.length}/${fresh.length}, website ${fresh.length}/${fresh.length}, email ${withEmail}, social ${withSocial}.`);

  await airtableAppend(fresh);
  await reportSpend(token);
  console.log("Done.");
}

main().catch((e) => {
  console.error("\n" + (e.message || e));
  process.exit(1);
});
