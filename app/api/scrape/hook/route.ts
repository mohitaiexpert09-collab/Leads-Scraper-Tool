import { NextResponse } from "next/server";
import { handleAdsStage, handlePagesStage } from "@/lib/scrape";

export const maxDuration = 60;

/**
 * Apify success webhook target. Apify POSTs here when an actor run finishes.
 * Secured by the ?secret= we embed in the webhook URL (must match CRON_SECRET).
 * ?stage=ads  -> filter advertisers, start Pages enrichment
 * ?stage=pages -> normalize + score + store leads
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const stage = url.searchParams.get("stage");
  const runRow = url.searchParams.get("run") || "";
  const secret = url.searchParams.get("secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let datasetId: string | undefined;
  try {
    const body = await req.json();
    datasetId = body?.resource?.defaultDatasetId;
  } catch {
    /* ignore */
  }
  if (!datasetId) return NextResponse.json({ error: "No datasetId in webhook payload" }, { status: 400 });

  try {
    if (stage === "ads") {
      await handleAdsStage(datasetId, runRow);
      return NextResponse.json({ ok: true, stage });
    }
    if (stage === "pages") {
      const result = await handlePagesStage(datasetId, runRow);
      return NextResponse.json({ ok: true, stage, ...result });
    }
    return NextResponse.json({ error: "Unknown stage" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Hook failed" }, { status: 500 });
  }
}
