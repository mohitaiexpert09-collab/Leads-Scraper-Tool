export type LeadSource = "google_maps" | "instagram" | "facebook" | "shopify" | "manual";

export type LeadStatus =
  | "new"
  | "contacted"
  | "follow_up"
  | "replied"
  | "qualified"
  | "won"
  | "lost";

export type Tier = 1 | 2 | 3 | 4;

export type ActivityType =
  | "note"
  | "call"
  | "message_sent"
  | "reply"
  | "status_change";

export type Channel = "whatsapp" | "email" | "dm" | "call" | "other";

export interface Lead {
  id: string;
  founder_name: string | null;
  company: string | null;
  website: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  category: string | null;
  source: LeadSource;
  followers: number | null;
  ads_running: boolean | null;
  tier: Tier;
  score: number;
  status: LeadStatus;
  owner_id: string | null;
  notes: string | null;
  raw_json: Record<string, unknown> | null;
  airtable_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  lead_id: string;
  type: ActivityType;
  channel: Channel | null;
  body: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FollowUp {
  id: string;
  lead_id: string;
  due_date: string;
  status: "pending" | "done";
  note: string | null;
  assignee: string | null;
  created_at: string;
  lead?: Pick<Lead, "id" | "founder_name" | "company" | "tier" | "status">;
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: Channel;
  body: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: string | null;
  created_at: string;
}

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  follow_up: "Follow-up",
  replied: "Replied",
  qualified: "Qualified",
  won: "Won",
  lost: "Lost",
};

export const STATUS_ORDER: LeadStatus[] = [
  "new",
  "contacted",
  "follow_up",
  "replied",
  "qualified",
  "won",
  "lost",
];

export const TIER_LABELS: Record<Tier, string> = {
  1: "Tier 1 · Hot",
  2: "Tier 2 · Warm",
  3: "Tier 3 · Cool",
  4: "Tier 4 · Cold",
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  google_maps: "Google Maps",
  instagram: "Instagram",
  facebook: "Facebook",
  shopify: "Shopify",
  manual: "Manual",
};
