"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import type { FollowUp } from "@/lib/types";
import { completeFollowUp } from "@/lib/actions";
import { Button, Card, CardContent, TierBadge, EmptyState } from "@/components/ui";

function FollowUpRow({ fu }: { fu: FollowUp }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const due = new Date(fu.due_date);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      {fu.lead && <TierBadge tier={fu.lead.tier} withLabel={false} />}
      <div className="min-w-0 flex-1">
        <Link href={`/leads/${fu.lead_id}`} className="text-sm font-medium hover:underline">
          {fu.lead?.company || "Lead"}
        </Link>
        <div className="truncate text-xs text-[var(--color-muted)]">
          {fu.note || "Follow up"} · due {due.toLocaleDateString()}
        </div>
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await completeFollowUp(fu.id);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Done
      </Button>
    </div>
  );
}

export function FollowUpsClient({ followUps }: { followUps: FollowUp[] }) {
  const now = Date.now();
  const startOfTomorrow = new Date();
  startOfTomorrow.setHours(0, 0, 0, 0);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const overdue = followUps.filter((f) => +new Date(f.due_date) < now);
  const today = followUps.filter(
    (f) => +new Date(f.due_date) >= now && +new Date(f.due_date) < +startOfTomorrow
  );
  const upcoming = followUps.filter((f) => +new Date(f.due_date) >= +startOfTomorrow);

  if (followUps.length === 0) {
    return (
      <Card>
        <CardContent className="pt-5">
          <EmptyState title="No pending follow-ups" hint="Schedule follow-ups from any lead's detail page." />
        </CardContent>
      </Card>
    );
  }

  const groups: [string, FollowUp[], string][] = [
    ["Overdue", overdue, "var(--color-danger)"],
    ["Today", today, "var(--color-warning)"],
    ["Upcoming", upcoming, "var(--color-brand-2)"],
  ];

  return (
    <div className="space-y-6">
      {groups.map(([label, list, color]) =>
        list.length ? (
          <div key={label} className="space-y-2">
            <h2 className="text-sm font-semibold" style={{ color }}>
              {label} <span className="text-[var(--color-muted)]">({list.length})</span>
            </h2>
            {list.map((fu) => (
              <FollowUpRow key={fu.id} fu={fu} />
            ))}
          </div>
        ) : null
      )}
    </div>
  );
}
