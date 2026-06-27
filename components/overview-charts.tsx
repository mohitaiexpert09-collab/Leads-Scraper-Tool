"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LeadSource, LeadStatus, Tier } from "@/lib/types";
import { SOURCE_LABELS, STATUS_LABELS, STATUS_ORDER } from "@/lib/types";

const TIER_COLORS: Record<Tier, string> = {
  1: "#f5b301",
  2: "#21c97a",
  3: "#4f9dff",
  4: "#6b7488",
};

const tooltipStyle = {
  background: "#161b27",
  border: "1px solid #2f3850",
  borderRadius: 10,
  fontSize: 12,
  color: "#e6e9f0",
};

export function TierDonut({ byTier }: { byTier: Record<Tier, number> }) {
  const data = ([1, 2, 3, 4] as Tier[]).map((t) => ({
    name: `Tier ${t}`,
    value: byTier[t],
    tier: t,
  }));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative h-52">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
            {data.map((d) => (
              <Cell key={d.tier} fill={TIER_COLORS[d.tier]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{total}</span>
        <span className="text-xs text-[var(--color-muted)]">leads</span>
      </div>
    </div>
  );
}

export function StatusFunnel({ byStatus }: { byStatus: Record<LeadStatus, number> }) {
  const data = STATUS_ORDER.filter((s) => s !== "lost").map((s) => ({
    name: STATUS_LABELS[s],
    value: byStatus[s],
  }));
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={72} tick={{ fill: "#aab2c2", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#7c5cff" barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SourceBars({ bySource }: { bySource: { source: LeadSource; count: number }[] }) {
  const data = bySource.map((s) => ({ name: SOURCE_LABELS[s.source], value: s.count }));
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -18, right: 8 }}>
          <XAxis dataKey="name" tick={{ fill: "#aab2c2", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#aab2c2", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#00d3a7" barSize={42} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
