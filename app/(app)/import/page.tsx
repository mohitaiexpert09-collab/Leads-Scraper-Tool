import { ImportClient } from "@/components/import-client";
import { Card, CardContent } from "@/components/ui";
import { ACTORS } from "@/lib/apify";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Import leads</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Paste or upload an Apify dataset (JSON/CSV). Leads are auto-normalized, scored Tier 1–4,
          and deduped before import.
        </p>
      </div>

      <ImportClient />

      <Card>
        <CardContent className="pt-5 text-sm text-[var(--color-text-dim)] space-y-2">
          <p className="font-medium text-[var(--color-text)]">How to get a dataset</p>
          <p>
            In your Claude session, run an Apify actor and download the dataset items, then paste them
            here:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-[var(--color-muted)]">
            <li>
              Google Maps (discovery): <code className="text-[var(--color-brand-2)]">{ACTORS.google_maps}</code>
            </li>
            <li>
              Instagram (enrich): <code className="text-[var(--color-brand-2)]">{ACTORS.instagram}</code>
            </li>
            <li>
              Facebook (enrich + ads): <code className="text-[var(--color-brand-2)]">{ACTORS.facebook}</code>
            </li>
          </ul>
          <p className="text-[var(--color-muted)]">
            Programmatic option: POST items to <code className="text-[var(--color-brand-2)]">/api/ingest</code>{" "}
            from n8n or an Apify webhook.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
