import Link from "next/link";
import { Download } from "lucide-react";
import { getLeads } from "@/lib/data";
import { LeadsTable } from "@/components/leads-table";
import { Button } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await getLeads();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Leads</h1>
          <p className="text-sm text-[var(--color-muted)]">
            All scraped D2C founders, auto-scored Tier 1–4 by RTO fit.
          </p>
        </div>
        <Link href="/import">
          <Button variant="secondary">
            <Download size={16} /> Import leads
          </Button>
        </Link>
      </div>
      <LeadsTable leads={leads} />
    </div>
  );
}
