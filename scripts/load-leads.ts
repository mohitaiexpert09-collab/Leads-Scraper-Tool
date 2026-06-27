/**
 * One-off loader: read scraped lead JSON files, normalize + Tier-score them with
 * the same logic the app uses, and insert into Supabase via the service-role key
 * (bypasses RLS). Usage:
 *   npx tsx scripts/load-leads.ts data/leads-reachable-india.json [more.json...]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { normalizeBatch } from "../lib/normalize";
import { onlyReachable } from "../lib/scrape-filters";

// Load env from .env.local (simple parser; no extra deps).
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

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const files = process.argv.slice(2);
  if (!files.length) throw new Error("Pass one or more JSON files to load.");

  const raw: Record<string, unknown>[] = [];
  for (const f of files) {
    const items = JSON.parse(readFileSync(f, "utf8"));
    raw.push(...(Array.isArray(items) ? items : items.items ?? []));
  }

  const normalized = onlyReachable(normalizeBatch(raw, "facebook"));
  console.log(`Parsed ${raw.length} rows -> ${normalized.length} unique, reachable leads.`);

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const keys = normalized.map((l) => l.dedupe_key);
  const { data: existing, error: selErr } = await admin.from("leads").select("dedupe_key").in("dedupe_key", keys);
  if (selErr) throw new Error("Select failed: " + selErr.message);
  const have = new Set((existing ?? []).map((r: { dedupe_key: string }) => r.dedupe_key));
  const fresh = normalized.filter((l) => !have.has(l.dedupe_key));

  if (fresh.length) {
    const { error } = await admin.from("leads").insert(fresh.map((l) => ({ ...l, status: "new" })));
    if (error) throw new Error("Insert failed: " + error.message);
  }

  const byTier = fresh.reduce((a, l) => ((a[l.tier] = (a[l.tier] || 0) + 1), a), {} as Record<number, number>);
  console.log(`Inserted ${fresh.length} new, skipped ${normalized.length - fresh.length} duplicates.`);
  console.log("By tier:", byTier);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
