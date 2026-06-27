"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2, Plus, Check, Loader2 } from "lucide-react";
import type { Channel, MessageTemplate } from "@/lib/types";
import { saveTemplate, deleteTemplate } from "@/lib/actions";
import { Button, Card, CardContent, Input, Select, Textarea, Badge } from "@/components/ui";

const CHANNELS: Channel[] = ["whatsapp", "email", "dm", "call", "other"];

export function TemplatesClient({ templates }: { templates: MessageTemplate[] }) {
  const [editing, setEditing] = useState<Partial<MessageTemplate> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    if (!editing?.name || !editing?.body) return;
    start(async () => {
      await saveTemplate({
        id: editing.id,
        name: editing.name!,
        channel: (editing.channel as Channel) || "whatsapp",
        body: editing.body!,
      });
      setEditing(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteTemplate(id);
      router.refresh();
    });
  }

  function copy(t: MessageTemplate) {
    navigator.clipboard.writeText(t.body);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ channel: "whatsapp" })}>
          <Plus size={16} /> New template
        </Button>
      </div>

      {editing && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex gap-2">
              <Input
                placeholder="Template name"
                value={editing.name || ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="flex-1"
              />
              <Select
                value={editing.channel || "whatsapp"}
                onChange={(e) => setEditing({ ...editing, channel: e.target.value as Channel })}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <Textarea
              rows={5}
              placeholder="Message body. Use {{founder}}, {{company}}, {{category}} as placeholders."
              value={editing.body || ""}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            />
            <div className="flex gap-2">
              <Button onClick={save} disabled={pending}>
                {pending ? <Loader2 size={15} className="animate-spin" /> : null} Save
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t.name}</span>
                <Badge className="capitalize text-[var(--color-muted)]">{t.channel}</Badge>
              </div>
              <p className="whitespace-pre-wrap rounded-lg bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-text-dim)]">
                {t.body}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => copy(t)}>
                  {copiedId === t.id ? <Check size={14} /> : <Copy size={14} />}
                  {copiedId === t.id ? "Copied" : "Copy"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(t.id)} disabled={pending}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
