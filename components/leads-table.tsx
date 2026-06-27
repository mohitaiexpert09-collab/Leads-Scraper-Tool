"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, MessageCircle, Globe, Instagram, Facebook } from "lucide-react";
import type { Lead, LeadSource, LeadStatus, Tier } from "@/lib/types";
import { SOURCE_LABELS, STATUS_LABELS, STATUS_ORDER } from "@/lib/types";
import { Input, Select, TierBadge, StatusBadge, EmptyState } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [source, setSource] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter((l) => {
      if (tier !== "all" && String(l.tier) !== tier) return false;
      if (status !== "all" && l.status !== status) return false;
      if (source !== "all" && l.source !== source) return false;
      if (
        q &&
        ![l.company, l.founder_name, l.category, l.city]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      )
        return false;
      return true;
    });
  }, [leads, search, tier, status, source]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-50">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input
            placeholder="Search company, founder, category, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="all">All tiers</option>
          {[1, 2, 3, 4].map((t) => (
            <option key={t} value={t}>
              Tier {t}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="all">All sources</option>
          {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Followers</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Reach</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const wa = whatsappLink(l.whatsapp || l.phone);
                return (
                  <tr key={l.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${l.id}`} className="block">
                        <div className="font-medium">{l.company || "—"}</div>
                        <div className="text-xs text-[var(--color-muted)]">
                          {l.founder_name || "Unknown"} · {l.city || "—"}
                          {l.ads_running && <span className="ml-1 text-[var(--color-tier1)]">· ⚡ads</span>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge tier={l.tier as Tier} withLabel={false} />
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-dim)]">{l.score}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-[var(--color-text-dim)]">
                      {formatNumber(l.followers)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-[var(--color-text-dim)]">
                      {l.category || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status as LeadStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-[var(--color-muted)]">
                        {wa && (
                          <a href={wa} target="_blank" rel="noreferrer" title="WhatsApp" className="hover:text-[var(--color-brand-2)]">
                            <MessageCircle size={16} />
                          </a>
                        )}
                        {l.website && (
                          <a href={l.website} target="_blank" rel="noreferrer" title="Website" className="hover:text-[var(--color-text)]">
                            <Globe size={16} />
                          </a>
                        )}
                        {l.instagram_url && (
                          <a href={l.instagram_url} target="_blank" rel="noreferrer" title="Instagram" className="hover:text-[#e1306c]">
                            <Instagram size={16} />
                          </a>
                        )}
                        {l.facebook_url && (
                          <a href={l.facebook_url} target="_blank" rel="noreferrer" title="Facebook" className="hover:text-[#1877f2]">
                            <Facebook size={16} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <EmptyState title="No leads match your filters" hint="Try clearing search or filters, or import a new batch." />
        )}
      </div>
      <p className="text-xs text-[var(--color-muted)]">
        Showing {filtered.length} of {leads.length} leads
      </p>
    </div>
  );
}
