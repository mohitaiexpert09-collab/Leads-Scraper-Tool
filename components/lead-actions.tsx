"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import type { ActivityType, Channel, LeadStatus, MessageTemplate } from "@/lib/types";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/types";
import { addActivity, scheduleFollowUp, setLeadStatus } from "@/lib/actions";
import { Button, Select, Textarea, Input } from "@/components/ui";

export function StatusControl({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <Select
        value={status}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await setLeadStatus(leadId, e.target.value as LeadStatus);
            router.refresh();
          })
        }
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      {pending && <Loader2 size={15} className="animate-spin text-[var(--color-muted)]" />}
    </div>
  );
}

const LOG_TYPES: { type: ActivityType; label: string; channel: Channel | null }[] = [
  { type: "message_sent", label: "Logged message sent", channel: "whatsapp" },
  { type: "reply", label: "Logged reply", channel: "whatsapp" },
  { type: "call", label: "Logged call", channel: "call" },
  { type: "note", label: "Added note", channel: null },
];

export function LogActivity({
  leadId,
  templates,
}: {
  leadId: string;
  templates: MessageTemplate[];
}) {
  const [type, setType] = useState<ActivityType>("message_sent");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [body, setBody] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    if (!body.trim()) return;
    start(async () => {
      await addActivity({ leadId, type, channel, body });
      setBody("");
      setDone(true);
      setTimeout(() => setDone(false), 1500);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
          <option value="message_sent">Message sent</option>
          <option value="reply">Reply received</option>
          <option value="call">Call</option>
          <option value="note">Note</option>
        </Select>
        <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="dm">DM</option>
          <option value="call">Call</option>
          <option value="other">Other</option>
        </Select>
        {templates.length > 0 && (
          <Select
            value=""
            onChange={(e) => {
              if (e.target.value) setBody(e.target.value);
            }}
          >
            <option value="">Insert template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.body}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      <Textarea
        rows={3}
        placeholder="What happened? (e.g. Sent WhatsApp intro about cutting RTO…)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button onClick={submit} disabled={pending || !body.trim()}>
        {pending ? <Loader2 size={15} className="animate-spin" /> : done ? <Check size={15} /> : null}
        {done ? "Saved" : "Log activity"}
      </Button>
    </div>
  );
}

export function FollowUpForm({ leadId }: { leadId: string }) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [date, setDate] = useState(tomorrow);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        <Input
          placeholder="Reminder note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="flex-1 min-w-40"
        />
      </div>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await scheduleFollowUp({ leadId, dueDate: date, note });
            setNote("");
            setDone(true);
            setTimeout(() => setDone(false), 1500);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : done ? <Check size={15} /> : null}
        {done ? "Scheduled" : "Schedule follow-up"}
      </Button>
    </div>
  );
}
