import { getFollowUps } from "@/lib/data";
import { FollowUpsClient } from "@/components/follow-ups-client";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const followUps = await getFollowUps();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Follow-ups</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Reminders to keep deals moving. Overdue ones are flagged in red.
        </p>
      </div>
      <FollowUpsClient followUps={followUps} />
    </div>
  );
}
