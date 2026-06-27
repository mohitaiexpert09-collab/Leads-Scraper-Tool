import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { hasServiceRole } from "@/lib/supabase/admin";
import { startScrape, runScrapeSync } from "@/lib/scrape";

// Allow up to 5 min when running in synchronous mode (Vercel Pro / local).
export const maxDuration = 300;

function preflight(): string | null {
  if (!process.env.APIFY_TOKEN) return "APIFY_TOKEN is not set. Add it to enable scraping.";
  if (!hasServiceRole()) return "SUPABASE_SERVICE_ROLE_KEY is not set. Needed to store leads automatically.";
  return null;
}

/** Vercel Cron calls GET daily. Secured by the CRON_SECRET bearer Vercel injects. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const err = preflight();
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const { runRow } = await startScrape();
  return NextResponse.json({ started: true, runRow, mode: "async" });
}

/** The dashboard "Scrape Now" button calls POST. Requires a logged-in user. */
export async function POST(req: Request) {
  const sb = await getSupabaseServer();
  if (sb) {
    const { data } = await sb.auth.getUser();
    if (!data.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const err = preflight();
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const mode = new URL(req.url).searchParams.get("mode");
  try {
    if (mode === "sync") {
      const result = await runScrapeSync();
      return NextResponse.json({ ok: true, mode: "sync", ...result });
    }
    const { runRow } = await startScrape();
    return NextResponse.json({ ok: true, mode: "async", runRow });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Scrape failed" }, { status: 500 });
  }
}
