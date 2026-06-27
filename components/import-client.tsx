"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { UploadCloud, FileJson, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { normalizeBatch, type NormalizedLead } from "@/lib/normalize";
import type { LeadSource } from "@/lib/types";
import { ingestLeads } from "@/lib/actions";
import { Button, Card, CardContent, Select, TierBadge, Textarea } from "@/components/ui";
import { formatNumber } from "@/lib/utils";

type Result = { inserted: number; duplicates: number } | null;

export function ImportClient() {
  const [source, setSource] = useState<"auto" | LeadSource>("auto");
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<NormalizedLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function parseItems(text: string): Record<string, unknown>[] {
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      const json = JSON.parse(trimmed);
      const arr = Array.isArray(json) ? json : json.items ?? json.data ?? [json];
      return arr as Record<string, unknown>[];
    }
    // CSV
    const out = Papa.parse(trimmed, { header: true, skipEmptyLines: true });
    return out.data as Record<string, unknown>[];
  }

  function buildPreview(text: string) {
    setError(null);
    setResult(null);
    try {
      const items = parseItems(text);
      if (!items.length) {
        setPreview([]);
        return;
      }
      const src = source === "auto" ? undefined : source;
      setPreview(normalizeBatch(items, src));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse input.");
      setPreview([]);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setRaw(text.slice(0, 200000));
      buildPreview(text);
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    start(async () => {
      const res = await ingestLeads(preview);
      setResult(res);
      setPreview([]);
      setRaw("");
      router.refresh();
    });
  }

  const tierCounts = preview.reduce(
    (acc, l) => ((acc[l.tier] = (acc[l.tier] || 0) + 1), acc),
    {} as Record<number, number>
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-[var(--color-muted)]">Source</label>
            <Select
              value={source}
              onChange={(e) => {
                setSource(e.target.value as typeof source);
                if (raw) buildPreview(raw);
              }}
            >
              <option value="auto">Auto-detect</option>
              <option value="google_maps">Google Maps</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </Select>

            <label className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-sm hover:border-[var(--color-border-strong)]">
              <UploadCloud size={16} /> Upload JSON / CSV
              <input type="file" accept=".json,.csv,.txt" className="hidden" onChange={onFile} />
            </label>
          </div>

          <Textarea
            rows={6}
            placeholder="…or paste the Apify dataset JSON (array of items) or CSV here"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              buildPreview(e.target.value);
            }}
            className="font-mono text-xs"
          />

          {error && (
            <p className="flex items-center gap-2 text-sm text-[var(--color-danger)]">
              <AlertTriangle size={15} /> {error}
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-5 text-sm">
            <CheckCircle2 className="text-[var(--color-success)]" />
            <span>
              Imported <b>{result.inserted}</b> new lead{result.inserted !== 1 ? "s" : ""}
              {result.duplicates > 0 && <> · skipped {result.duplicates} duplicate(s)</>}.
            </span>
            <Button variant="secondary" className="ml-auto" onClick={() => router.push("/leads")}>
              View leads
            </Button>
          </CardContent>
        </Card>
      )}

      {preview.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <FileJson size={16} className="text-[var(--color-brand)]" />
                <b>{preview.length}</b> leads parsed (deduped)
                <span className="flex gap-1">
                  {[1, 2, 3, 4].map((t) =>
                    tierCounts[t] ? (
                      <span key={t} className="text-xs text-[var(--color-muted)]">
                        T{t}:{tierCounts[t]}
                      </span>
                    ) : null
                  )}
                </span>
              </div>
              <Button onClick={confirmImport} disabled={pending}>
                {pending ? <Loader2 size={15} className="animate-spin" /> : null}
                Import {preview.length} leads
              </Button>
            </div>
            <div className="max-h-96 overflow-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--color-surface-2)] text-left text-xs text-[var(--color-muted)]">
                  <tr>
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Tier</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2 hidden md:table-cell">Followers</th>
                    <th className="px-3 py-2 hidden md:table-cell">City</th>
                    <th className="px-3 py-2">WhatsApp</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 100).map((l, i) => (
                    <tr key={i} className="border-t border-[var(--color-border)]">
                      <td className="px-3 py-2">{l.company || "—"}</td>
                      <td className="px-3 py-2">
                        <TierBadge tier={l.tier} withLabel={false} />
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-dim)]">{l.score}</td>
                      <td className="px-3 py-2 hidden md:table-cell text-[var(--color-text-dim)]">
                        {formatNumber(l.followers)}
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell text-[var(--color-text-dim)]">{l.city || "—"}</td>
                      <td className="px-3 py-2 text-[var(--color-text-dim)]">{l.whatsapp || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
