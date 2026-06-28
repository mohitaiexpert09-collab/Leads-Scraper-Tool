"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MessageCircle, Mail, ThumbsUp, ThumbsDown } from "lucide-react";
import type { ActivityType, Channel, LeadStatus, MessageTemplate } from "@/lib/types";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/types";
import { addActivity, logOutreach, scheduleFollowUp, setDisposition, setLeadStatus } from "@/lib/actions";
import { Button, Select, Textarea, Input, buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Send + auto-track outreach. Opens WhatsApp/email pre-filled, and the moment
 * you do, logs "message sent" and advances a new lead to Contacted — so you
 * always know whom you've reached. Plus one-tap Interested / Not interested.
 */
export function OutreachActions({
  leadId,
  whatsappHref,
  emailHref,
  messagePreview,
  emailSubject,
}: {
  leadId: string;
  whatsappHref: string | null;
  emailHref: string | null;
  messagePreview: string | null;
  emailSubject: string | null;
}) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState<string | null>(null);
  const router = useRouter();

  function track(channel: Channel, body: string) {
    start(async () => {
      await logOutreach({ leadId, channel, body });
      setSent(channel);
      setTimeout(() => setSent(null), 1800);
      router.refresh();
    });
  }

  function disposition(kind: "interested" | "not_interested") {
    start(async () => {
      await setDisposition(leadId, kind);
      router.refresh();
    });
  }

  if (!whatsappHref && !emailHref) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-muted)]">No WhatsApp or email on file. Add a contact to enable one-tap outreach.</p>
        <Dispositions onPick={disposition} pending={pending} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("whatsapp", `Sent WhatsApp${messagePreview ? `: ${messagePreview}` : ""}`)}
            className={cn(buttonVariants({ variant: "primary" }))}
          >
            <MessageCircle size={15} /> Send WhatsApp
          </a>
        )}
        {emailHref && (
          <a
            href={emailHref}
            onClick={() => track("email", `Sent email${emailSubject ? `: ${emailSubject}` : ""}`)}
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            <Mail size={15} /> Send Email
          </a>
        )}
        {pending && <Loader2 size={15} className="animate-spin text-[var(--color-muted)] self-center" />}
      </div>
      {sent && (
        <p className="flex items-center gap-1.5 text-xs text-[var(--color-brand-2)]">
          <Check size={13} /> Logged {sent === "whatsapp" ? "WhatsApp" : "email"} sent · lead marked Contacted
        </p>
      )}
      <div className="border-t border-[var(--color-border)] pt-3">
        <p className="mb-2 text-xs text-[var(--color-muted)]">After they reply, tag the outcome:</p>
        <Dispositions onPick={disposition} pending={pending} />
      </div>
    </div>
  );
}

function Dispositions({
  onPick,
  pending,
}: {
  onPick: (k: "interested" | "not_interested") => void;
  pending: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={pending} onClick={() => onPick("interested")}>
        <ThumbsUp size={15} /> Interested
      </Button>
      <Button variant="ghost" disabled={pending} onClick={() => onPick("not_interested")}>
        <ThumbsDown size={15} /> Not interested
      </Button>
    </div>
  );
}

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
