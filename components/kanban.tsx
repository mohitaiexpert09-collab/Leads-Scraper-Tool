"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Lead, LeadStatus } from "@/lib/types";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/types";
import { setLeadStatus } from "@/lib/actions";
import { TierBadge } from "@/components/ui";
import { cn, formatNumber } from "@/lib/utils";

export function Kanban({ leads }: { leads: Lead[] }) {
  const [items, setItems] = useState(leads);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<LeadStatus | null>(null);
  const [, start] = useTransition();
  const router = useRouter();

  function onDrop(status: LeadStatus) {
    setOverCol(null);
    if (!dragId) return;
    const lead = items.find((l) => l.id === dragId);
    setDragId(null);
    if (!lead || lead.status === status) return;
    // optimistic
    setItems((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    start(async () => {
      await setLeadStatus(lead.id, status);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STATUS_ORDER.map((status) => {
        const colLeads = items.filter((l) => l.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(status);
            }}
            onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
            onDrop={() => onDrop(status)}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-xl border bg-[var(--color-surface)] transition-colors",
              overCol === status ? "border-[var(--color-brand)]" : "border-[var(--color-border)]"
            )}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border)]">
              <span className="text-sm font-medium">{STATUS_LABELS[status]}</span>
              <span className="rounded-full bg-[var(--color-surface-2)] px-2 text-xs text-[var(--color-muted)]">
                {colLeads.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2 min-h-24">
              {colLeads.map((l) => (
                <div
                  key={l.id}
                  draggable
                  onDragStart={() => setDragId(l.id)}
                  onDragEnd={() => setDragId(null)}
                  className={cn(
                    "cursor-grab rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 active:cursor-grabbing",
                    dragId === l.id && "opacity-40"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/leads/${l.id}`} className="text-sm font-medium hover:underline">
                      {l.company || "—"}
                    </Link>
                    <TierBadge tier={l.tier} withLabel={false} />
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-muted)]">
                    {l.founder_name || "—"} · {l.city || "—"}
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--color-muted)]">
                    {formatNumber(l.followers)} followers{l.ads_running ? " · ⚡ads" : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
