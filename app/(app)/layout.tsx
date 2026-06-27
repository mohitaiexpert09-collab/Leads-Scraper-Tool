import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { getFollowUps, getCurrentUserEmail, isSupabaseConfigured } from "@/lib/data";
import { Avatar } from "@/components/ui";
import { initials } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [followUps, email] = await Promise.all([getFollowUps(), getCurrentUserEmail()]);
  const overdue = followUps.filter((f) => +new Date(f.due_date) < Date.now()).length;
  const demo = !isSupabaseConfigured();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar followUpsDue={followUps.length} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5">
          <Link href="/" className="md:hidden font-bold gradient-text">
            RTO Leads
          </Link>
          {demo && (
            <span className="rounded-full bg-[var(--color-warning)]/15 px-3 py-1 text-xs font-medium text-[var(--color-warning)]">
              Demo mode — sample data. Add Supabase keys to save real leads.
            </span>
          )}
          {overdue > 0 && (
            <Link
              href="/follow-ups"
              className="rounded-full bg-[var(--color-danger)]/15 px-3 py-1 text-xs font-medium text-[var(--color-danger)]"
            >
              {overdue} follow-up{overdue > 1 ? "s" : ""} overdue
            </Link>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:block text-xs text-[var(--color-muted)]">{email}</span>
            <Avatar label={initials(email?.split("@")[0])} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
