import "server-only";
import type {
  Activity,
  FollowUp,
  Lead,
  LeadSource,
  LeadStatus,
  MessageTemplate,
  Tier,
} from "./types";
import { STATUS_ORDER } from "./types";
import { getSupabaseServer } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/config";
import { demoStore } from "./demo-store";

export { isSupabaseConfigured };

export interface LeadFilters {
  status?: LeadStatus | "all";
  tier?: Tier | "all";
  source?: LeadSource | "all";
  city?: string;
  search?: string;
}

function applyFilters(leads: Lead[], f: LeadFilters = {}): Lead[] {
  let out = leads;
  if (f.status && f.status !== "all") out = out.filter((l) => l.status === f.status);
  if (f.tier && f.tier !== "all") out = out.filter((l) => l.tier === f.tier);
  if (f.source && f.source !== "all") out = out.filter((l) => l.source === f.source);
  if (f.city) out = out.filter((l) => (l.city || "").toLowerCase() === f.city!.toLowerCase());
  if (f.search) {
    const q = f.search.toLowerCase();
    out = out.filter(
      (l) =>
        (l.company || "").toLowerCase().includes(q) ||
        (l.founder_name || "").toLowerCase().includes(q) ||
        (l.category || "").toLowerCase().includes(q) ||
        (l.city || "").toLowerCase().includes(q)
    );
  }
  return [...out].sort(
    (a, b) => a.tier - b.tier || b.score - a.score || +new Date(b.created_at) - +new Date(a.created_at)
  );
}

export async function getLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  const sb = await getSupabaseServer();
  if (!sb) return applyFilters(demoStore().leads, filters);
  const { data } = await sb.from("leads").select("*").order("tier").order("score", { ascending: false });
  return applyFilters((data ?? []) as Lead[], filters);
}

export async function getLead(id: string): Promise<Lead | null> {
  const sb = await getSupabaseServer();
  if (!sb) return demoStore().leads.find((l) => l.id === id) ?? null;
  const { data } = await sb.from("leads").select("*").eq("id", id).maybeSingle();
  return (data as Lead) ?? null;
}

export async function getActivities(leadId: string): Promise<Activity[]> {
  const sb = await getSupabaseServer();
  if (!sb)
    return demoStore()
      .activities.filter((a) => a.lead_id === leadId)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const { data } = await sb
    .from("activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Activity[];
}

export async function getFollowUps(): Promise<FollowUp[]> {
  const sb = await getSupabaseServer();
  if (!sb) {
    const { leads, followUps } = demoStore();
    return followUps
      .filter((f) => f.status === "pending")
      .map((f) => ({ ...f, lead: leads.find((l) => l.id === f.lead_id) }))
      .sort((a, b) => +new Date(a.due_date) - +new Date(b.due_date));
  }
  const { data } = await sb
    .from("follow_ups")
    .select("*, lead:leads(id, founder_name, company, tier, status)")
    .eq("status", "pending")
    .order("due_date");
  return (data ?? []) as unknown as FollowUp[];
}

export async function getTemplates(): Promise<MessageTemplate[]> {
  const sb = await getSupabaseServer();
  if (!sb) return demoStore().templates;
  const { data } = await sb.from("message_templates").select("*").order("created_at");
  return (data ?? []) as MessageTemplate[];
}

export interface OverviewStats {
  total: number;
  newToday: number;
  byTier: Record<Tier, number>;
  byStatus: Record<LeadStatus, number>;
  followUpsDue: number;
  overdue: number;
  replyRate: number;
  won: number;
  bySource: { source: LeadSource; count: number }[];
  recent: Lead[];
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const leads = await getLeads();
  const followUps = await getFollowUps();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const byTier = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<Tier, number>;
  const byStatus = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<LeadStatus, number>;
  const bySourceMap = new Map<LeadSource, number>();

  for (const l of leads) {
    byTier[l.tier]++;
    byStatus[l.status]++;
    bySourceMap.set(l.source, (bySourceMap.get(l.source) ?? 0) + 1);
  }

  const contacted = leads.filter((l) =>
    ["contacted", "follow_up", "replied", "qualified", "won", "lost"].includes(l.status)
  ).length;
  const replied = leads.filter((l) => ["replied", "qualified", "won"].includes(l.status)).length;
  const now = Date.now();

  return {
    total: leads.length,
    newToday: leads.filter((l) => +new Date(l.created_at) >= +startOfToday).length,
    byTier,
    byStatus,
    followUpsDue: followUps.length,
    overdue: followUps.filter((f) => +new Date(f.due_date) < now).length,
    replyRate: contacted ? Math.round((replied / contacted) * 100) : 0,
    won: byStatus.won,
    bySource: [...bySourceMap.entries()].map(([source, count]) => ({ source, count })),
    recent: leads.slice(0, 6),
  };
}

export async function getCurrentUserEmail(): Promise<string | null> {
  const sb = await getSupabaseServer();
  if (!sb) return "demo@local";
  const { data } = await sb.auth.getUser();
  return data.user?.email ?? null;
}
