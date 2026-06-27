import { CheckCircle2, XCircle } from "lucide-react";
import { isSupabaseConfigured, getCurrentUserEmail } from "@/lib/data";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { ManualAddLead, SignOutButton, ScrapeNow } from "@/components/settings-client";
import { DEFAULT_WEIGHTS } from "@/lib/scoring";
import { ACTORS, hasApifyToken } from "@/lib/apify";
import { hasServiceRole } from "@/lib/supabase/admin";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

function StatusRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-[var(--color-surface-2)] p-3">
      {ok ? (
        <CheckCircle2 className="text-[var(--color-success)] shrink-0" size={18} />
      ) : (
        <XCircle className="text-[var(--color-muted)] shrink-0" size={18} />
      )}
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-[var(--color-muted)]">{hint}</div>
      </div>
    </div>
  );
}

async function getLastRun() {
  const sb = await getSupabaseServer();
  if (!sb) return null;
  const { data } = await sb
    .from("scrape_runs")
    .select("status, leads_found, started_at, params")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { status: string; leads_found: number | null; started_at: string } | null;
}

export default async function SettingsPage() {
  const supa = isSupabaseConfigured();
  const apify = hasApifyToken();
  const serviceRole = hasServiceRole();
  const cronSecret = Boolean(process.env.CRON_SECRET);
  const siteUrl = Boolean(process.env.NEXT_PUBLIC_SITE_URL);
  const automationReady = apify && serviceRole && cronSecret;
  const email = await getCurrentUserEmail();
  const lastRun = await getLastRun();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Settings</h1>
          <p className="text-sm text-[var(--color-muted)]">Connections, automation, scoring, and team.</p>
        </div>
        {supa && <SignOutButton />}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Connections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusRow
              ok={supa}
              label={supa ? "Supabase connected" : "Supabase not configured (demo mode)"}
              hint={supa ? `Signed in as ${email}. Data is persistent & multi-user.` : "Add NEXT_PUBLIC_SUPABASE_* to .env.local, then run supabase/schema.sql."}
            />
            <StatusRow ok={apify} label={apify ? "Apify token set" : "Apify token not set"} hint="Lets the app run scrapers itself." />
            <StatusRow ok={serviceRole} label={serviceRole ? "Service role key set" : "Service role key missing"} hint="Lets cron/webhooks store leads automatically." />
            <StatusRow ok={cronSecret} label={cronSecret ? "Cron secret set" : "Cron secret missing"} hint="Secures the scrape + webhook endpoints." />
            <StatusRow ok={siteUrl} label={siteUrl ? "Site URL set" : "Site URL missing"} hint="Needed so Apify webhooks can call back (your deployed URL)." />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <ScrapeNow ready={automationReady} />
          <Card>
            <CardHeader>
              <CardTitle>Automation status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] p-3">
                <span className="text-[var(--color-muted)]">Daily auto-scrape</span>
                <Badge className={automationReady ? "text-[var(--color-success)]" : "text-[var(--color-muted)]"}>
                  {automationReady ? "Scheduled · 9:30 AM IST" : "Inactive"}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] p-3">
                <span className="text-[var(--color-muted)]">Last run</span>
                <span>
                  {lastRun
                    ? `${lastRun.status} · ${lastRun.leads_found ?? 0} leads · ${timeAgo(lastRun.started_at)}`
                    : "never"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Scrapers (Apify actors)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(ACTORS).map(([source, id]) => (
              <div key={source} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] p-2.5">
                <span className="capitalize">{source.replace("_", " ")}</span>
                <code className="text-xs text-[var(--color-brand-2)]">{id}</code>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tier scoring weights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-[var(--color-muted)]">
              Current weights (edit in <code>lib/scoring.ts</code>). T1 ≥ 70 · T2 ≥ 50 · T3 ≥ 30 · else T4.
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(DEFAULT_WEIGHTS).map(([k, v]) => (
                <Badge key={k} className="text-[var(--color-text-dim)]">
                  {k}: <b className="ml-1">+{v}</b>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <ManualAddLead />
      </div>
    </div>
  );
}
