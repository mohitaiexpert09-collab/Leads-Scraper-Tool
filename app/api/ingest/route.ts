import { NextResponse } from "next/server";
import { normalizeBatch } from "@/lib/normalize";
import { ingestLeads } from "@/lib/actions";
import type { LeadSource } from "@/lib/types";

/**
 * POST /api/ingest
 * Body: { items: object[], source?: "google_maps"|"instagram"|"facebook" }
 *   or a bare array of items.
 * Use from n8n / an Apify webhook to push scraped datasets straight into the CRM.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items: Record<string, unknown>[] = Array.isArray(body) ? body : body.items ?? [];
    const source: LeadSource | undefined = Array.isArray(body) ? undefined : body.source;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Provide a non-empty `items` array." }, { status: 400 });
    }

    const normalized = normalizeBatch(items, source);
    const result = await ingestLeads(normalized);
    return NextResponse.json({ parsed: normalized.length, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ingest failed" },
      { status: 500 }
    );
  }
}
