import { getTemplates } from "@/lib/data";
import { TemplatesClient } from "@/components/templates-client";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await getTemplates();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Message templates</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Reusable outreach scripts. Copy them when messaging, or insert directly from a lead&apos;s
          page. Placeholders: <code className="text-[var(--color-brand-2)]">{`{{founder}} {{company}} {{category}}`}</code>
        </p>
      </div>
      <TemplatesClient templates={templates} />
    </div>
  );
}
