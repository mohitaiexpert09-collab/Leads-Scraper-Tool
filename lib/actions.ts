"use server";

import { revalidatePath } from "next/cache";
import type { ActivityType, Channel, LeadStatus, MessageTemplate } from "./types";
import type { NormalizedLead } from "./normalize";
import { getSupabaseServer } from "./supabase/server";
import { demoStore } from "./demo-store";
import { getCurrentUserEmail } from "./data";

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function revalidateAll() {
  for (const p of ["/", "/leads", "/pipeline", "/follow-ups", "/templates"]) revalidatePath(p);
}

/** Insert normalized leads, skipping duplicates by dedupe_key. */
export async function ingestLeads(
  leads: NormalizedLead[]
): Promise<{ inserted: number; duplicates: number }> {
  const sb = await getSupabaseServer();

  if (!sb) {
    const store = demoStore();
    const existing = new Set(
      store.leads.map((l) =>
        l.website
          ? `site:${l.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}`
          : l.id
      )
    );
    let inserted = 0;
    let duplicates = 0;
    for (const l of leads) {
      if (existing.has(l.dedupe_key)) {
        duplicates++;
        continue;
      }
      existing.add(l.dedupe_key);
      const now = new Date().toISOString();
      const { dedupe_key, ...rest } = l;
      store.leads.unshift({
        id: uid("lead"),
        ...rest,
        status: "new",
        owner_id: null,
        notes: null,
        created_at: now,
        updated_at: now,
      });
      store.activities.push({
        id: uid("act"),
        lead_id: store.leads[0].id,
        type: "note",
        channel: null,
        body: `Imported from ${l.source}`,
        created_by: "import",
        created_at: now,
      });
      inserted++;
    }
    revalidateAll();
    return { inserted, duplicates };
  }

  const keys = leads.map((l) => l.dedupe_key);
  const { data: existingRows } = await sb.from("leads").select("dedupe_key").in("dedupe_key", keys);
  const existing = new Set((existingRows ?? []).map((r: { dedupe_key: string }) => r.dedupe_key));
  const fresh = leads.filter((l) => !existing.has(l.dedupe_key));
  const duplicates = leads.length - fresh.length;
  if (fresh.length) {
    const rows = fresh.map(({ ...l }) => ({ ...l, status: "new" as LeadStatus }));
    const { error } = await sb.from("leads").insert(rows);
    if (error) throw new Error(error.message);
  }
  revalidateAll();
  return { inserted: fresh.length, duplicates };
}

export async function setLeadStatus(id: string, status: LeadStatus) {
  const sb = await getSupabaseServer();
  const actor = await getCurrentUserEmail();
  if (!sb) {
    const store = demoStore();
    const lead = store.leads.find((l) => l.id === id);
    if (lead) {
      const prev = lead.status;
      lead.status = status;
      lead.updated_at = new Date().toISOString();
      store.activities.push({
        id: uid("act"),
        lead_id: id,
        type: "status_change",
        channel: null,
        body: `${prev} → ${status}`,
        created_by: actor,
        created_at: lead.updated_at,
      });
    }
    revalidateAll();
    return;
  }
  await sb.from("leads").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  await sb.from("activities").insert({
    lead_id: id,
    type: "status_change" as ActivityType,
    body: `Status changed to ${status}`,
  });
  revalidateAll();
}

export async function addActivity(input: {
  leadId: string;
  type: ActivityType;
  channel?: Channel | null;
  body: string;
}) {
  const sb = await getSupabaseServer();
  const actor = await getCurrentUserEmail();
  if (!sb) {
    demoStore().activities.push({
      id: uid("act"),
      lead_id: input.leadId,
      type: input.type,
      channel: input.channel ?? null,
      body: input.body,
      created_by: actor,
      created_at: new Date().toISOString(),
    });
    revalidatePath(`/leads/${input.leadId}`);
    revalidateAll();
    return;
  }
  await sb.from("activities").insert({
    lead_id: input.leadId,
    type: input.type,
    channel: input.channel ?? null,
    body: input.body,
  });
  revalidatePath(`/leads/${input.leadId}`);
  revalidateAll();
}

/**
 * Record an outreach touch (WhatsApp/email/DM) the moment the user opens the
 * send link. Logs a "message sent" activity and auto-advances a brand-new lead
 * to "Contacted" so you always know whom you've reached out to.
 */
export async function logOutreach(input: { leadId: string; channel: Channel; body: string }) {
  const sb = await getSupabaseServer();
  const actor = await getCurrentUserEmail();
  const now = new Date().toISOString();
  if (!sb) {
    const store = demoStore();
    store.activities.push({
      id: uid("act"),
      lead_id: input.leadId,
      type: "message_sent",
      channel: input.channel,
      body: input.body,
      created_by: actor,
      created_at: now,
    });
    const lead = store.leads.find((l) => l.id === input.leadId);
    if (lead && lead.status === "new") {
      lead.status = "contacted";
      lead.updated_at = now;
    }
    revalidatePath(`/leads/${input.leadId}`);
    revalidateAll();
    return;
  }
  await sb.from("activities").insert({
    lead_id: input.leadId,
    type: "message_sent" as ActivityType,
    channel: input.channel,
    body: input.body,
  });
  // Only nudge a fresh lead forward; never override a later stage.
  await sb.from("leads").update({ status: "contacted", updated_at: now }).eq("id", input.leadId).eq("status", "new");
  revalidatePath(`/leads/${input.leadId}`);
  revalidateAll();
}

/**
 * One-tap conversation outcome. "Interested" → Qualified, "Not interested" →
 * Lost. Logs the disposition with a timestamp so the funnel stays accurate.
 */
export async function setDisposition(leadId: string, disposition: "interested" | "not_interested") {
  const status: LeadStatus = disposition === "interested" ? "qualified" : "lost";
  const note = disposition === "interested" ? "Marked Interested 👍" : "Marked Not interested 👎";
  const sb = await getSupabaseServer();
  const actor = await getCurrentUserEmail();
  const now = new Date().toISOString();
  if (!sb) {
    const store = demoStore();
    const lead = store.leads.find((l) => l.id === leadId);
    if (lead) {
      lead.status = status;
      lead.updated_at = now;
    }
    store.activities.push({
      id: uid("act"),
      lead_id: leadId,
      type: "note",
      channel: null,
      body: note,
      created_by: actor,
      created_at: now,
    });
    revalidatePath(`/leads/${leadId}`);
    revalidateAll();
    return;
  }
  await sb.from("leads").update({ status, updated_at: now }).eq("id", leadId);
  await sb.from("activities").insert({ lead_id: leadId, type: "note" as ActivityType, body: note });
  revalidatePath(`/leads/${leadId}`);
  revalidateAll();
}

export async function scheduleFollowUp(input: { leadId: string; dueDate: string; note?: string }) {
  const sb = await getSupabaseServer();
  if (!sb) {
    demoStore().followUps.push({
      id: uid("fu"),
      lead_id: input.leadId,
      due_date: new Date(input.dueDate).toISOString(),
      status: "pending",
      note: input.note ?? null,
      assignee: await getCurrentUserEmail(),
      created_at: new Date().toISOString(),
    });
    revalidateAll();
    return;
  }
  await sb.from("follow_ups").insert({
    lead_id: input.leadId,
    due_date: new Date(input.dueDate).toISOString(),
    note: input.note ?? null,
  });
  revalidateAll();
}

export async function completeFollowUp(id: string) {
  const sb = await getSupabaseServer();
  if (!sb) {
    const fu = demoStore().followUps.find((f) => f.id === id);
    if (fu) fu.status = "done";
    revalidateAll();
    return;
  }
  await sb.from("follow_ups").update({ status: "done" }).eq("id", id);
  revalidateAll();
}

export async function saveTemplate(input: Omit<MessageTemplate, "id" | "created_at"> & { id?: string }) {
  const sb = await getSupabaseServer();
  if (!sb) {
    const store = demoStore();
    if (input.id) {
      const t = store.templates.find((x) => x.id === input.id);
      if (t) Object.assign(t, input);
    } else {
      store.templates.push({
        id: uid("tpl"),
        name: input.name,
        channel: input.channel,
        body: input.body,
        created_at: new Date().toISOString(),
      });
    }
    revalidatePath("/templates");
    return;
  }
  if (input.id) {
    await sb.from("message_templates").update({ name: input.name, channel: input.channel, body: input.body }).eq("id", input.id);
  } else {
    await sb.from("message_templates").insert({ name: input.name, channel: input.channel, body: input.body });
  }
  revalidatePath("/templates");
}

export async function deleteTemplate(id: string) {
  const sb = await getSupabaseServer();
  if (!sb) {
    const store = demoStore();
    store.templates = store.templates.filter((t) => t.id !== id);
    revalidatePath("/templates");
    return;
  }
  await sb.from("message_templates").delete().eq("id", id);
  revalidatePath("/templates");
}

export async function createManualLead(input: {
  founder_name?: string;
  company: string;
  website?: string;
  instagram_url?: string;
  phone?: string;
  email?: string;
  city?: string;
  category?: string;
}) {
  const { normalizeItem } = await import("./normalize");
  const lead = normalizeItem({ ...input }, "manual");
  return ingestLeads([lead]);
}
