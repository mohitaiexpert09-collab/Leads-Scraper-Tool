/**
 * One-off refresh: replace all leads with SMALL Indian *clothing* brands on
 * INSTAGRAM whose follower count is ~1,000–2,000 (easy to reach, not big D2C).
 * Fast two-stage official pipeline:
 *   1) apify/instagram-hashtag-scraper  -> brand usernames from clothing hashtags
 *   2) apify/instagram-profile-scraper  -> followers, website, bio, category
 * Then keep clothing brands in the follower band, mine the bio for email/phone,
 * DELETE all current leads, insert the fresh set, and refresh the Airtable mirror.
 *
 * Usage: npx tsx scripts/refresh-instagram-clothing-leads.ts
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
const HASHTAG_ACTOR = "apify~instagram-hashtag-scraper";
const PROFILE_ACTOR = "apify~instagram-profile-scraper";
const TARGET = 100;
const FOLLOWERS_MIN = 1000;
const FOLLOWERS_MAX = 3000; // widened band to reach ~50-100 small brands
const POSTS_PER_TAG = 45;
const USERNAME_CAP = 700;

const HASHTAGS = [
  "kurti",
  "kurtis",
  "ethnicwear",
  "sareelove",
  "indianwear",
  "boutiqueindia",
  "kurtiset",
  "designerwear",
  "womensfashion",
  "cottonkurti",
  "anarkalisuit",
  "lehengalove",
  "handloomsaree",
  "indianfashion",
  "kurtishop",
  "sareeshopping",
  "ethnicwearindia",
  "womensethnicwear",
  "dupattaset",
  "cottonsaree",
  "printedkurti",
  "kurtilove",
  "handblockprint",
  "banarasisaree",
  "sareecollection",
  "suratsaree",
  "chikankarikurti",
  "boutiquecollection",
  "kurtiwholesale",
  "suratdress",
  "jaipuriprint",
  "blockprint",
  "bandhani",
  "phulkari",
  "kanjivaram",
  "silksaree",
  "georgettesaree",
  "partywearsaree",
  "festivewear",
  "indowestern",
  "palazzoset",
  "coordset",
  "ethnicset",
  "designerkurti",
  "boutiquewear",
  "clothingbrandindia",
  "kurtidress",
  "kurticollection",
  "ethnicfashion",
  "sareeblouse",
  "handloomlove",
];

const CLOTHING_RE =
  /cloth|apparel|fashion|boutique|ethnic|wear|kurti|saree|lehenga|salwar|anarkali|designer|garment|textile|dress|silk|chikankari|kurta|couture|label|studio|outfit|drape|attire|threads/i;
const EXCLUDE_RE =
  /amazon|flipkart|myntra|\bajio\b|nykaa|meesho|reliance|\bzudio\b|westside|max fashion|fabindia|\bbiba\b|pantaloons|lifestyle|shoppers stop|mamaearth|\blibas\b|go colors/i;
const NONCLOTHING_RE =
  /hotel|homestay|resort|hostel|\bstay\b|villa|\bcafe\b|restaurant|salon|\bspa\b|\bgym\b|clinic|photograph|makeup\s?artist|academy|realestate|properties|jewel/i;

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const IN_PHONE_RE = /(?:\+?\s?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runActor(token: string, actor: string, input: unknown, deadlineMin = 10): Promise<Record<string, any>[]> {
  const start = await fetch(`${APIFY}/acts/${actor}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!start.ok) throw new Error(`Apify start ${actor} failed (${start.status}): ${(await start.text()).slice(0, 200)}`);
  const { data: run } = await start.json();
  const deadline = Date.now() + deadlineMin * 60 * 1000;
  let status = "RUNNING";
  while (Date.now() < deadline) {
    await sleep(8000);
    const s = await (await fetch(`${APIFY}/actor-runs/${run.id}?token=${token}`)).json();
    status = s?.data?.status;
    process.stdout.write(`\r  ${actor}: ${status}   `);
    if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) break;
  }
  console.log("");
  if (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
    await fetch(`${APIFY}/actor-runs/${run.id}/abort?token=${token}`, { method: "POST" });
  }
  return (await (
    await fetch(`${APIFY}/datasets/${run.defaultDatasetId}/items?token=${token}&clean=true&limit=2000`)
  ).json()) as Record<string, any>[];
}

function isKeeper(p: Record<string, any>): boolean {
  const followers = Number(p.followersCount);
  const text = `${p.businessCategoryName || ""} ${p.fullName || ""} ${p.username || ""} ${p.biography || ""}`;
  return (
    followers >= FOLLOWERS_MIN &&
    followers <= FOLLOWERS_MAX &&
    CLOTHING_RE.test(text) &&
    !EXCLUDE_RE.test(text) &&
    !NONCLOTHING_RE.test(text)
  );
}

function toRaw(p: Record<string, any>): Record<string, any> {
  const bio = p.biography || "";
  const email = bio.match(EMAIL_RE)?.[0]?.toLowerCase() || null;
  const phoneMatch = bio.match(IN_PHONE_RE)?.[0] || null;
  return {
    company: p.fullName || p.username,
    website: p.externalUrl || null,
    email,
    phone: phoneMatch,
    whatsapp: phoneMatch,
    instagram_url: p.url || (p.username ? `https://instagram.com/${p.username}` : null),
    facebook_url: null,
    followers: Number(p.followersCount) || null,
    category: p.businessCategoryName || "Clothing brand",
    ads_running: null,
  };
}

async function airtableInsert(leads: Record<string, any>[], replace: boolean) {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) {
    console.log("Airtable not configured — skipping mirror refresh.");
    return;
  }
  const table = encodeURIComponent(process.env.AIRTABLE_TABLE || "Leads");
  const url = `https://api.airtable.com/v0/${base}/${table}`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  let deleted = 0;
  if (replace) {
    for (;;) {
      const page = await (await fetch(`${url}?pageSize=10&fields%5B%5D=Company`, { headers })).json();
      const ids: string[] = (page.records || []).map((r: any) => r.id);
      if (!ids.length) break;
      await fetch(`${url}?${ids.map((id) => `records[]=${id}`).join("&")}`, { method: "DELETE", headers });
      deleted += ids.length;
      if (!page.offset && ids.length < 10) break;
    }
  }
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
        Followers: l.followers ?? null,
        Category: l.category ?? "",
        Source: l.source ?? "",
      },
    }));
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ records: batch, typecast: true }) });
    if (res.ok) created += batch.length;
    else if (created === 0) console.error("Airtable insert error:", res.status, (await res.text()).slice(0, 200));
  }
  console.log(`Airtable refreshed — deleted ${deleted}, created ${created}.`);
}

async function main() {
  loadEnv();
  const token = process.env.APIFY_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token) throw new Error("Missing APIFY_TOKEN");
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  // Stage 1: hashtag posts -> unique brand usernames.
  console.log(`Stage 1: hashtag scrape (${HASHTAGS.length} tags × ${POSTS_PER_TAG})…`);
  const posts = await runActor(token, HASHTAG_ACTOR, { hashtags: HASHTAGS, resultsType: "posts", resultsLimit: POSTS_PER_TAG }, 8);
  const usernames = Array.from(
    new Set(posts.map((p) => (p.ownerUsername || "").trim()).filter(Boolean))
  ).slice(0, USERNAME_CAP);
  console.log(`Got ${posts.length} posts -> ${usernames.length} unique usernames.`);
  if (!usernames.length) throw new Error("No usernames from hashtags — NOT deleting current leads.");

  // Stage 2: enrich profiles (followers, website, bio, category).
  console.log(`Stage 2: profile scrape (${usernames.length} usernames)…`);
  const profiles = await runActor(token, PROFILE_ACTOR, { usernames }, 12);
  console.log(`Enriched ${profiles.length} profiles.`);

  const keepers = profiles.filter(isKeeper).sort((a, b) => Number(b.followersCount) - Number(a.followersCount));
  console.log(`${keepers.length} match (clothing + ${FOLLOWERS_MIN}-${FOLLOWERS_MAX} followers).`);

  const normalized = normalizeBatch(keepers.map(toRaw), "instagram")
    .filter((l) => l.instagram_url && l.followers && l.followers >= FOLLOWERS_MIN && l.followers <= FOLLOWERS_MAX)
    // Prioritise the most complete: email+phone first, then email, then rest.
    .sort((a, b) => score(b) - score(a))
    .slice(0, TARGET);
  console.log(`Keeping top ${normalized.length} unique leads.`);

  if (!normalized.length) throw new Error("No leads found — nothing to do.");

  const admin = createClient(url, key, { auth: { persistSession: false } });

  // ACCUMULATE by default so repeated runs build up toward 50-100 without losing
  // prior leads. Set REPLACE=1 to wipe and replace instead.
  const replace = process.env.REPLACE === "1";
  if (replace) {
    const { count: before } = await admin.from("leads").select("id", { count: "exact", head: true });
    const { error: delErr } = await admin.from("leads").delete().not("id", "is", null);
    if (delErr) throw new Error("Delete failed: " + delErr.message);
    console.log(`REPLACE mode: deleted ${before ?? "?"} existing leads.`);
  }

  // Dedupe the new batch against what's already stored.
  const keys = normalized.map((l) => l.dedupe_key);
  const { data: existing } = await admin.from("leads").select("dedupe_key").in("dedupe_key", keys);
  const have = new Set((existing ?? []).map((r: { dedupe_key: string }) => r.dedupe_key));
  const fresh = normalized.filter((l) => !have.has(l.dedupe_key));

  if (fresh.length) {
    const { error: insErr } = await admin.from("leads").insert(fresh.map((l) => ({ ...l, status: "new" })));
    if (insErr) throw new Error("Insert failed: " + insErr.message);
  }
  const { count: total } = await admin.from("leads").select("id", { count: "exact", head: true });
  console.log(`Inserted ${fresh.length} new (skipped ${normalized.length - fresh.length} already present). Total leads now: ${total ?? "?"}.`);

  const withEmail = fresh.filter((l) => l.email).length;
  const withPhone = fresh.filter((l) => l.phone || l.whatsapp).length;
  const withSite = fresh.filter((l) => l.website).length;
  console.log(`New-lead coverage — email ${withEmail}, phone ${withPhone}, website ${withSite} of ${fresh.length}.`);

  await airtableInsert(fresh, replace);
  console.log("Done.");
}

function score(l: Record<string, any>): number {
  return (l.email ? 2 : 0) + (l.phone || l.whatsapp ? 1 : 0) + (l.website ? 0.5 : 0);
}

main().catch((e) => {
  console.error("\n" + (e.message || e));
  process.exit(1);
});
