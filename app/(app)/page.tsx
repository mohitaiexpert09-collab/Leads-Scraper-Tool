import Link from "next/link";
import { TrendingUp, Users, MessageCircle, Trophy, CalendarClock, Flame } from "lucide-react";
import { getOverviewStats } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, TierBadge, StatusBadge } from "@/components/ui";
import { TierDonut, StatusFunnel, SourceBars } from "@/components/overview-charts";
import { formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Stat({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <Card className="animate-fade-up">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-muted)]">{label}</span>
          <span style={{ color: accent }}>{icon}</span>
        </div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
        {sub && <div className="mt-1 text-xs text-[var(--color-muted)]">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default async function OverviewPage() {
  const s = await getOverviewStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Overview</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Your D2C RTO-reduction pipeline at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={<Users size={18} />} label="Total leads" value={s.total} sub={`${s.newToday} added today`} accent="#7c5cff" />
        <Stat icon={<Flame size={18} />} label="Tier 1 (hot)" value={s.byTier[1]} sub={`${s.byTier[2]} in Tier 2`} accent="#f5b301" />
        <Stat icon={<MessageCircle size={18} />} label="Reply rate" value={`${s.replyRate}%`} sub="of contacted leads" accent="#00d3a7" />
        <Stat icon={<Trophy size={18} />} label="Won" value={s.won} sub="closed deals" accent="#21c97a" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Leads by tier</CardTitle>
          </CardHeader>
          <CardContent>
            <TierDonut byTier={s.byTier} />
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {([1, 2, 3, 4] as const).map((t) => (
                <TierBadge key={t} tier={t} />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pipeline funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusFunnel byStatus={s.byStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Leads by source</CardTitle>
          </CardHeader>
          <CardContent>
            <SourceBars bySource={s.bySource} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent leads</CardTitle>
            <Link href="/leads" className="text-xs text-[var(--color-brand)] hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {s.recent.map((l) => (
              <Link
                key={l.id}
                href={`/leads/${l.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--color-surface-2)]"
              >
                <TierBadge tier={l.tier} withLabel={false} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{l.company}</div>
                  <div className="truncate text-xs text-[var(--color-muted)]">
                    {l.founder_name} · {l.city} · {formatNumber(l.followers)} followers
                  </div>
                </div>
                <StatusBadge status={l.status} />
                <span className="hidden sm:block w-16 text-right text-xs text-[var(--color-muted)]">
                  {timeAgo(l.created_at)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Follow-ups</CardTitle>
            <Link href="/follow-ups" className="text-xs text-[var(--color-brand)] hover:underline">
              Open →
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 rounded-lg bg-[var(--color-surface-2)] p-4">
              <CalendarClock className="text-[var(--color-warning)]" />
              <div>
                <div className="text-2xl font-bold">{s.followUpsDue}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  pending · <span className="text-[var(--color-danger)]">{s.overdue} overdue</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <TrendingUp size={14} /> Tier 1 + Tier 2 are your best-fit RTO prospects — work them first.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
