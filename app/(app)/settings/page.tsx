import { CheckCircle2, XCircle } from "lucide-react";
import { isSupabaseConfigured, getCurrentUserEmail } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { ManualAddLead, SignOutButton } from "@/components/settings-client";
import { DEFAULT_WEIGHTS } from "@/lib/scoring";
import { ACTORS, hasApifyToken } from "@/lib/apify";

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

export default async function SettingsPage() {
  const supa = isSupabaseConfigured();
  const apify = hasApifyToken();
  const email = await getCurrentUserEmail();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Settings</h1>
          <p className="text-sm text-[var(--color-muted)]">Connections, scoring, and team.</p>
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
              hint={
                supa
                  ? `Signed in as ${email}. Data is persistent & multi-user.`
                  : "Add NEXT_PUBLIC_SUPABASE_URL & ANON_KEY to .env.local, then run supabase/schema.sql."
              }
            />
            <StatusRow
              ok={apify}
              label={apify ? "Apify token set" : "Apify token not set"}
              hint={
                apify
                  ? "The app can run scrapers automatically."
                  : "Optional. Until added, run actors in your Claude session and use Import."
              }
            />
          </CardContent>
        </Card>

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
