"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, UserPlus, Zap, AlertTriangle } from "lucide-react";
import { createManualLead } from "@/lib/actions";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";

export function ManualAddLead() {
  const [form, setForm] = useState({ company: "", founder_name: "", website: "", instagram_url: "", phone: "", email: "", city: "", category: "" });
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a lead manually</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Company *" value={form.company} onChange={set("company")} />
          <Input placeholder="Founder name" value={form.founder_name} onChange={set("founder_name")} />
          <Input placeholder="Website" value={form.website} onChange={set("website")} />
          <Input placeholder="Instagram URL" value={form.instagram_url} onChange={set("instagram_url")} />
          <Input placeholder="Phone" value={form.phone} onChange={set("phone")} />
          <Input placeholder="Email" value={form.email} onChange={set("email")} />
          <Input placeholder="City" value={form.city} onChange={set("city")} />
          <Input placeholder="Category" value={form.category} onChange={set("category")} />
        </div>
        <Button
          disabled={pending || !form.company}
          onClick={() =>
            start(async () => {
              await createManualLead(form);
              setForm({ company: "", founder_name: "", website: "", instagram_url: "", phone: "", email: "", city: "", category: "" });
              setDone(true);
              setTimeout(() => setDone(false), 1500);
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : done ? <Check size={15} /> : <UserPlus size={15} />}
          {done ? "Added" : "Add lead"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ScrapeNow({ ready }: { ready: boolean }) {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setPending(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/scrape/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scrape failed");
      if (data.mode === "sync") {
        setMsg(`Done — ${data.inserted} new leads added (${data.duplicates} duplicates skipped).`);
      } else {
        setMsg("Scrape started! Fresh leads will appear here in ~3–5 minutes (Apify is running).");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run a scrape</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-[var(--color-muted)]">
          Pulls Indian D2C brands currently running Facebook/Instagram ads, enriches WhatsApp &
          contacts, scores Tier 1–4, and stores them automatically.
        </p>
        <Button onClick={run} disabled={pending || !ready}>
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
          {pending ? "Starting…" : "Scrape now"}
        </Button>
        {!ready && (
          <p className="flex items-center gap-2 text-xs text-[var(--color-warning)]">
            <AlertTriangle size={14} /> Add APIFY_TOKEN + SUPABASE_SERVICE_ROLE_KEY + CRON_SECRET to enable.
          </p>
        )}
        {msg && <p className="text-xs text-[var(--color-brand-2)]">{msg}</p>}
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </CardContent>
    </Card>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const sb = getSupabaseBrowser();
          if (sb) await sb.auth.signOut();
          router.push("/login");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : null} Sign out
    </Button>
  );
}
