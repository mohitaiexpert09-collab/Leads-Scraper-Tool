import type { LeadSource, Tier } from "./types";
import { scoreLead, ScoreWeights } from "./scoring";
import { toIndianE164 } from "./whatsapp";

/** A lead shaped for insertion into the `leads` table (no id / timestamps). */
export interface NormalizedLead {
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
  raw_json: Record<string, unknown>;
  dedupe_key: string;
}

type Raw = Record<string, any>;

function firstString(...vals: any[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length && typeof v[0] === "string") return v[0].trim();
  }
  return null;
}

function firstNumber(...vals: any[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

// Hosts that are NOT a brand's real website — social profiles, chat & link shorteners.
// We must not treat these as the dedupe key, or unrelated brands collapse into one.
const NON_WEBSITE_HOSTS = new Set([
  "instagram.com",
  "facebook.com",
  "fb.com",
  "wa.me",
  "whatsapp.com",
  "chat.whatsapp.com",
  "linktr.ee",
  "bit.ly",
  "linkedin.com",
  "youtube.com",
  "twitter.com",
  "x.com",
  "g.page",
  "goo.gl",
]);

function domain(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function isRealWebsite(url: string | null): boolean {
  const d = domain(url);
  return Boolean(d && !NON_WEBSITE_HOSTS.has(d));
}

function igUrlFromUsername(username: string | null): string | null {
  if (!username) return null;
  const u = username.replace(/^@/, "").trim();
  return u ? `https://instagram.com/${u}` : null;
}

/** Best-effort source detection from the shape of an Apify dataset item. */
export function detectSource(raw: Raw): LeadSource {
  if (raw.myshopifyDomain !== undefined || raw.sampleProducts !== undefined) return "shopify";
  if (raw.username !== undefined || raw.followersCount !== undefined) return "instagram";
  if (raw.pageUrl !== undefined || raw.adStatus !== undefined || raw.likes !== undefined)
    return "facebook";
  if (raw.placeId !== undefined || raw.categoryName !== undefined || raw.searchString !== undefined)
    return "google_maps";
  return "manual";
}

function normalizeOne(raw: Raw, source: LeadSource): Omit<NormalizedLead, "tier" | "score" | "dedupe_key"> {
  // Social links can come as arrays from the contact-enrichment add-ons.
  const instagram =
    firstString(raw.instagram_url, raw.instagramUrl, raw.instagrams) ||
    (source === "instagram" ? igUrlFromUsername(firstString(raw.username)) : null) ||
    igUrlFromUsername(firstString(raw.instagramUsername));

  const facebook = firstString(
    raw.facebook_url,
    raw.facebookUrl,
    raw.facebooks,
    source === "facebook" ? raw.pageUrl : null,
    source === "facebook" ? raw.url : null
  );

  const linkedin = firstString(raw.linkedin_url, raw.linkedInUrl, raw.linkedIns, raw.linkedins);

  const website = firstString(
    raw.website,
    raw.websiteUrl,
    raw.externalUrl,
    Array.isArray(raw.externalUrls) ? raw.externalUrls[0]?.url : null,
    raw.domain
  );

  const phoneRaw = firstString(
    raw.phone,
    raw.phoneUnformatted,
    raw.businessPhoneNumber,
    raw.phones,
    raw.contactPhone
  );

  const email = firstString(raw.email, raw.emails, raw.businessEmail, raw.contactEmail);

  const company = firstString(
    raw.company,
    source === "instagram" ? raw.fullName : null,
    raw.title,
    raw.name,
    raw.pageName,
    source === "instagram" ? raw.username : null
  );

  const founder = firstString(raw.founder_name, raw.founderName, raw.ownerName, raw.contactName);

  const city = firstString(raw.city, raw.location, raw.addressCity);

  const category = firstString(
    raw.category,
    raw.categoryName,
    raw.businessCategoryName,
    Array.isArray(raw.categories) ? raw.categories[0] : raw.categories
  );

  const followers = firstNumber(raw.followers, raw.followersCount, raw.likes, raw.followersAmount);

  const adsRunning =
    typeof raw.ads_running === "boolean"
      ? raw.ads_running
      : typeof raw.adStatus === "string"
      ? /active|running|yes/i.test(raw.adStatus)
      : typeof raw.isRunningAds === "boolean"
      ? raw.isRunningAds
      : typeof raw.pageAdLibraryIsBusinessPageActive === "boolean"
      ? raw.pageAdLibraryIsBusinessPageActive
      : null;

  const whatsapp = toIndianE164(firstString(raw.whatsapp, raw.whatsApp)) || toIndianE164(phoneRaw);

  // Many Google Maps places list a social/chat/shortener link as their "website".
  // Keep only a genuine website; salvage an Instagram link into instagram_url.
  const websiteHref = website ? (website.startsWith("http") ? website : `https://${website}`) : null;
  const realWebsite = isRealWebsite(websiteHref) ? websiteHref : null;
  const igFromWebsite = !instagram && domain(websiteHref) === "instagram.com" ? websiteHref : null;
  const fbFromWebsite = !facebook && domain(websiteHref) === "facebook.com" ? websiteHref : null;

  return {
    founder_name: founder,
    company,
    website: realWebsite,
    instagram_url: instagram || igFromWebsite,
    facebook_url: facebook || fbFromWebsite,
    linkedin_url: linkedin,
    phone: phoneRaw,
    whatsapp,
    email,
    city,
    category,
    source,
    followers,
    ads_running: adsRunning,
    raw_json: raw,
  };
}

function dedupeKey(l: { website: string | null; instagram_url: string | null; whatsapp: string | null; phone: string | null; company: string | null; city: string | null }): string {
  const d = isRealWebsite(l.website) ? domain(l.website) : null;
  if (d) return `site:${d}`;
  if (l.instagram_url) return `ig:${l.instagram_url.toLowerCase().replace(/\/$/, "")}`;
  const e = l.whatsapp || toIndianE164(l.phone);
  if (e) return `tel:${e}`;
  return `name:${(l.company || "").toLowerCase()}|${(l.city || "").toLowerCase()}`;
}

/** Normalize + score a single raw Apify item. */
export function normalizeItem(raw: Raw, source?: LeadSource, weights?: ScoreWeights): NormalizedLead {
  const src = source ?? detectSource(raw);
  const base = normalizeOne(raw, src);
  const { score, tier } = scoreLead(
    {
      adsRunning: base.ads_running,
      category: base.category,
      followers: base.followers,
      phone: base.phone,
      whatsapp: base.whatsapp,
      website: base.website,
      email: base.email,
    },
    weights
  );
  return { ...base, score, tier, dedupe_key: dedupeKey(base) };
}

/** Normalize a whole Apify dataset, dropping in-batch duplicates (keeps best score). */
export function normalizeBatch(items: Raw[], source?: LeadSource, weights?: ScoreWeights): NormalizedLead[] {
  const byKey = new Map<string, NormalizedLead>();
  for (const raw of items) {
    const lead = normalizeItem(raw, source, weights);
    const existing = byKey.get(lead.dedupe_key);
    if (!existing || lead.score > existing.score) byKey.set(lead.dedupe_key, lead);
  }
  return [...byKey.values()];
}
