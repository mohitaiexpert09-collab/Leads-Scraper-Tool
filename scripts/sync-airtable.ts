/**
 * One-off backfill: push every lead in Supabase into Airtable (one-way mirror),
 * saving each new Airtable record id back onto the lead so future updates PATCH
 * the same row. Idempotent — rerunning updates existing rows instead of dupes.
 *
 * Usage: npx tsx scripts/sync-airtable.ts
 * Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   AIRTABLE_TOKEN, AIRTABLE_BASE_ID, optional AIRTABLE_TABLE (default "Leads").
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

type Lead = Record<string, any>;

function fields(l: Lead): Record<string, unknown> {
  return {
    Company: l.company ?? "",
    Founder: l.founder_name ?? "",
    Tier: l.tier ?? null,
    Score: l.score ?? null,
    Status: l.status ?? "",
    WhatsApp: l.whatsapp ?? "",
    Phone: l.phone ?? "",
    Email: l.email ?? "",
    Website: l.website ?? "",
    Instagram: l.instagram_url ?? "",
    Facebook: l.facebook_url ?? "",
    City: l.city ?? "",
    Category: l.category ?? "",
    Source: l.source ?? "",
    Followers: l.followers ?? null,
    "Ads Running": l.ads_running ?? false,
  };
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = encodeURIComponent(process.env.AIRTABLE_TABLE || "Leads");
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !base) throw new Error("Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID");

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: leads, error } = await admin.from("leads").select("*").order("created_at", { ascending: true });
  if (error) throw new Error("Select failed: " + error.message);
  if (!leads?.length) {
    console.log("No leads to sync.");
    return;
  }

  const API = "https://api.airtable.com/v0";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const l of leads as Lead[]) {
    const body = JSON.stringify({ fields: fields(l), typecast: true });
    try {
      if (l.airtable_id) {
        const res = await fetch(`${API}/${base}/${table}/${l.airtable_id}`, { method: "PATCH", headers, body });
        res.ok ? updated++ : failed++;
      } else {
        const res = await fetch(`${API}/${base}/${table}`, { method: "POST", headers, body });
        if (!res.ok) {
          failed++;
          if (failed <= 3) console.error("Airtable error:", res.status, (await res.text()).slice(0, 200));
          continue;
        }
        const recId = (await res.json())?.id;
        if (recId) {
          await admin.from("leads").update({ airtable_id: recId }).eq("id", l.id);
          created++;
        }
      }
    } catch (e) {
      failed++;
      if (failed <= 3) console.error("Sync error:", e instanceof Error ? e.message : e);
    }
  }

  console.log(`Airtable sync done — created ${created}, updated ${updated}, failed ${failed}, total ${leads.length}.`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
