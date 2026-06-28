import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MessageCircle,
  Globe,
  Instagram,
  Facebook,
  Linkedin,
  Mail,
  Phone,
  MapPin,
  Users,
  Sparkles,
} from "lucide-react";
import { getActivities, getLead, getTemplates } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, TierBadge, Badge } from "@/components/ui";
import { StatusControl, LogActivity, FollowUpForm, OutreachActions } from "@/components/lead-actions";
import { scoreLead } from "@/lib/scoring";
import { whatsappLink } from "@/lib/whatsapp";
import { formatNumber, timeAgo } from "@/lib/utils";
import type { Tier } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACTIVITY_LABELS: Record<string, string> = {
  note: "Note",
  call: "Call",
  message_sent: "Message sent",
  reply: "Reply",
  status_change: "Status change",
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const [activities, templates] = await Promise.all([getActivities(id), getTemplates()]);
  const { reasons } = scoreLead({
    adsRunning: lead.ads_running,
    category: lead.category,
    followers: lead.followers,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    website: lead.website,
    email: lead.email,
  });

  const intro = templates[0]?.body
    .replace(/\{\{founder\}\}/g, lead.founder_name || "there")
    .replace(/\{\{company\}\}/g, lead.company || "your brand")
    .replace(/\{\{category\}\}/g, lead.category || "D2C");
  const wa = whatsappLink(lead.whatsapp || lead.phone, intro);

  // Pre-filled email (mailto) for one-tap, auto-tracked email outreach.
  const emailSubject = `Cutting RTO losses for ${lead.company || "your brand"}`;
  const emailHref = lead.email
    ? `mailto:${lead.email}?subject=${encodeURIComponent(emailSubject)}${intro ? `&body=${encodeURIComponent(intro)}` : ""}`
    : null;

  const contacts = [
    wa && { icon: <MessageCircle size={16} />, label: "WhatsApp", href: wa, color: "var(--color-brand-2)" },
    lead.phone && { icon: <Phone size={16} />, label: lead.phone, href: `tel:${lead.phone}` },
    lead.email && { icon: <Mail size={16} />, label: lead.email, href: `mailto:${lead.email}` },
    lead.website && { icon: <Globe size={16} />, label: "Website", href: lead.website },
    lead.instagram_url && { icon: <Instagram size={16} />, label: "Instagram", href: lead.instagram_url },
    lead.facebook_url && { icon: <Facebook size={16} />, label: "Facebook", href: lead.facebook_url },
    lead.linkedin_url && { icon: <Linkedin size={16} />, label: "LinkedIn", href: lead.linkedin_url },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; href: string; color?: string }[];

  return (
    <div className="space-y-6">
      <Link href="/leads" className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]">
        <ArrowLeft size={15} /> Back to leads
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <TierBadge tier={lead.tier as Tier} />
          <div>
            <h1 className="text-xl font-bold">{lead.company || "Unknown company"}</h1>
            <p className="text-sm text-[var(--color-muted)]">
              {lead.founder_name || "Unknown founder"}
              {lead.city && (
                <>
                  {" "}
                  · <MapPin size={12} className="inline" /> {lead.city}
                </>
              )}
            </p>
          </div>
        </div>
        <StatusControl leadId={lead.id} status={lead.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: contact + score */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {contacts.length === 0 && <p className="text-sm text-[var(--color-muted)]">No contact info captured.</p>}
              {contacts.map((c, i) => (
                <a
                  key={i}
                  href={c.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-[var(--color-surface-2)]"
                  style={c.color ? { color: c.color } : undefined}
                >
                  {c.icon}
                  <span className="truncate">{c.label}</span>
                </a>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lead snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted)] flex items-center gap-1">
                  <Users size={14} /> Followers
                </span>
                <span>{formatNumber(lead.followers)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted)]">Category</span>
                <span>{lead.category || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted)]">Running ads</span>
                <span>{lead.ads_running ? "Yes ⚡" : lead.ads_running === false ? "No" : "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted)]">Source</span>
                <span className="capitalize">{lead.source.replace("_", " ")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted)] flex items-center gap-1">
                  <Sparkles size={14} /> Fit score
                </span>
                <span className="font-semibold">{lead.score}/100</span>
              </div>
              {reasons.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {reasons.map((r) => (
                    <Badge key={r} className="text-[10px] text-[var(--color-text-dim)]">
                      {r}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: log + timeline */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Outreach</CardTitle>
            </CardHeader>
            <CardContent>
              <OutreachActions
                leadId={lead.id}
                whatsappHref={wa}
                emailHref={emailHref}
                messagePreview={intro ?? null}
                emailSubject={emailSubject}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Log outreach manually</CardTitle>
            </CardHeader>
            <CardContent>
              <LogActivity leadId={lead.id} templates={templates} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule follow-up</CardTitle>
            </CardHeader>
            <CardContent>
              <FollowUpForm leadId={lead.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">No activity yet.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-[var(--color-border)] pl-5">
                  {activities.map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full bg-[var(--color-brand)] ring-4 ring-[var(--color-surface)]" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{ACTIVITY_LABELS[a.type] ?? a.type}</span>
                        {a.channel && (
                          <Badge className="text-[10px] capitalize text-[var(--color-muted)]">{a.channel}</Badge>
                        )}
                        <span className="ml-auto text-[10px] text-[var(--color-muted)]">{timeAgo(a.created_at)}</span>
                      </div>
                      {a.body && <p className="mt-1 text-sm text-[var(--color-text-dim)]">{a.body}</p>}
                      {a.created_by && (
                        <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">by {a.created_by}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
