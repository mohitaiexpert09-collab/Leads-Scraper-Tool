import { getLeads } from "@/lib/data";
import { Kanban } from "@/components/kanban";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const leads = await getLeads();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Pipeline</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Drag leads across stages. Changes are saved and logged automatically.
        </p>
      </div>
      <Kanban leads={leads} />
    </div>
  );
}
