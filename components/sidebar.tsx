"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  CalendarClock,
  Download,
  MessageSquareText,
  Settings,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock },
  { href: "/import", label: "Import", icon: Download },
  { href: "/templates", label: "Templates", icon: MessageSquareText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ followUpsDue = 0 }: { followUpsDue?: number }) {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <Link href="/" className="flex items-center gap-2 px-2 pb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand)] text-white">
          <Zap size={18} fill="white" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold gradient-text">RTO Leads</div>
          <div className="text-[10px] text-[var(--color-muted)]">D2C Lead CRM</div>
        </div>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-[var(--color-brand-soft)] text-[var(--color-text)] font-medium"
                  : "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
              )}
            >
              <Icon size={17} />
              <span>{label}</span>
              {label === "Follow-ups" && followUpsDue > 0 && (
                <span className="ml-auto rounded-full bg-[var(--color-warning)] px-1.5 text-[10px] font-bold text-black">
                  {followUpsDue}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-muted)]">
        <p className="font-medium text-[var(--color-text-dim)]">Niche</p>
        <p className="mt-1">Cutting COD RTO for Indian D2C founders.</p>
      </div>
    </aside>
  );
}
