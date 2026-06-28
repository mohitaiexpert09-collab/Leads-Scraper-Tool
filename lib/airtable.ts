import "server-only";
import { getSupabaseAdmin } from "./supabase/admin";
import type { Lead } from "./types";

/**
 * One-way mirror: push leads from our DB into an Airtable base the founder
 * watches live. Best-effort — every call is wrapped so a mirror failure never
 * breaks the underlying app write. No-ops when Airtable env vars are absent.
 *
 * Required env: AIRTABLE_TOKEN (PAT, scopes data.records:read/write),
 *               AIRTABLE_BASE_ID, optional AIRTABLE_TABLE (default "Leads").
 * The Airtable table should have these columns (text unless noted):
 *   Company, Founder, Tier (number), Score (number), Status, WhatsApp, Phone,
 *   Email, Website, Instagram, Facebook, City, Category, Source,
 *   Followers (number), Ads Running (checkbox).
 */

const API = "https://api.airtable.com/v0";

export function hasAirtable(): boolean {
  return Boolean(process.env.AIRTABLE_TOKEN && process.env.AIRTABLE_BASE_ID);
}

function cfg(): { token: string; base: string; table: string } | null {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) return null;
  return { token, base, table: encodeURIComponent(process.env.AIRTABLE_TABLE || "Leads") };
}

type LeadLike = Partial<Lead> & { id?: string; airtable_id?: string | null };

function fields(lead: LeadLike): Record<string, unknown> {
  return {
    Company: lead.company ?? "",
    Founder: lead.founder_name ?? "",
    Tier: lead.tier ?? null,
    Score: lead.score ?? null,
    Status: lead.status ?? "",
    WhatsApp: lead.whatsapp ?? "",
    Phone: lead.phone ?? "",
    Email: lead.email ?? "",
    Website: lead.website ?? "",
    Instagram: lead.instagram_url ?? "",
    Facebook: lead.facebook_url ?? "",
    City: lead.city ?? "",
    Category: lead.category ?? "",
    Source: lead.source ?? "",
    Followers: lead.followers ?? null,
    "Ads Running": lead.ads_running ?? false,
  };
}

/** Create (or update, if already mirrored) one lead's Airtable record. */
export async function syncLeadToAirtable(lead: LeadLike): Promise<void> {
  const c = cfg();
  if (!c) return;
  try {
    const headers = { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" };
    const body = JSON.stringify({ fields: fields(lead), typecast: true });

    if (lead.airtable_id) {
      await fetch(`${API}/${c.base}/${c.table}/${lead.airtable_id}`, { method: "PATCH", headers, body });
      return;
    }
    const res = await fetch(`${API}/${c.base}/${c.table}`, { method: "POST", headers, body });
    if (!res.ok) return;
    const recId = (await res.json())?.id;
    if (recId && lead.id) {
      const admin = getSupabaseAdmin();
      if (admin) await admin.from("leads").update({ airtable_id: recId }).eq("id", lead.id);
    }
  } catch {
    /* best-effort mirror; never break the app write */
  }
}

/** Convenience: fetch the current lead by id (incl. airtable_id) and mirror it. */
export async function syncLeadById(id: string): Promise<void> {
  if (!hasAirtable()) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;
  try {
    const { data } = await admin.from("leads").select("*").eq("id", id).maybeSingle();
    if (data) await syncLeadToAirtable(data as LeadLike);
  } catch {
    /* best-effort */
  }
}
