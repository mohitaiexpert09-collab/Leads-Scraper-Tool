/**
 * Pure (no server-only) filtering + mapping helpers for the scrape pipeline.
 * Tuned to surface SMALL, founder-led, easily-reachable Indian D2C brands —
 * the ones most likely to take a call from a new agency — and to drop
 * marketplaces and big/funded brands that won't engage early outreach.
 */

// India D2C, high-RTO niches to search the Ad Library for.
export const NICHE_QUERIES = [
  "kurti brand",
  "ethnic wear",
  "women clothing brand",
  "boutique",
  "skincare",
  "handmade",
  "ayurvedic",
  "fashion accessories",
  "shapewear",
];

// Marketplaces, platforms AND well-known big/funded brands we never want as leads.
const EXCLUDE_NAME = new RegExp(
  [
    // marketplaces / platforms
    "amazon", "flipkart", "myntra", "\\bajio\\b", "nykaa", "meesho", "tata\\s?cliq", "\\btira\\b",
    "purplle", "firstcry", "naaptol", "snapdeal", "\\bgoogle\\b", "\\btiktok\\b", "\\bmeta\\b",
    "^facebook", "instagram", "youtube", "shopify", "reliance",
    // big retail / FMCG
    "l['’]?or[ée]al", "garnier", "himalaya", "eucerin", "caudalie", "\\bnivea\\b", "maybelline",
    "westside", "\\bsoch\\b", "\\bzudio\\b", "\\bw\\s?for\\s?woman", "biba", "fabindia", "max\\s?fashion",
    // well-funded D2C (won't trust a new agency early)
    "mamaearth", "\\bplix\\b", "minimalist", "mcaffeine", "foxtale", "the\\s?derma\\s?co", "pilgrim",
    "\\btraya\\b", "\\bwow\\b", "\\bsugar\\b", "beardo", "\\bboat\\b", "\\bnoise\\b", "sirona",
    "bombay\\s?shaving", "the\\s?man\\s?company", "bewakoof", "clinikally", "forever52", "caratlane",
    "kalki", "bownbee",
  ].join("|"),
  "i"
);

// Destination hosts that aren't a brand's own site (app stores, marketplaces, social).
const BAD_LINK_HOST = new Set([
  "play.google.com", "apps.apple.com", "amazon.in", "amazon.com", "google.com",
  "fb.com", "fb.me", "facebook.com", "instagram.com",
]);

const BRAND_CATEGORY =
  /cloth|apparel|fashion|wear|boutique|beauty|cosmetic|skin|hair|health|wellness|jewel|footwear|shoe|accessor|perfum|design|handmade|handicraft/i;

// Reachable founder-brand sweet spot for ad-page audience size.
const MAX_PAGE_LIKES = 150_000; // above this = too big / well-resourced

function host(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return null;
  }
}

export interface AdItem {
  pageName?: string | null;
  pageUrl?: string | null;
  linkUrl?: string | null;
  linkCaption?: string | null;
  pageLikeCount?: number | null;
  pageCategories?: string[] | null;
  ctaType?: string | null;
}

/**
 * Pick unique, small, founder-led D2C advertiser page URLs to enrich.
 * WhatsApp-CTA advertisers are prioritised (easiest to reach).
 */
export function pickAdvertisers(ads: AdItem[], cap = 25): string[] {
  const scored: { url: string; priority: number }[] = [];
  const seen = new Set<string>();

  for (const ad of ads) {
    const name = ad.pageName || "";
    const pageUrl = ad.pageUrl || "";
    if (!pageUrl) continue;
    if (EXCLUDE_NAME.test(name)) continue;

    const likes = ad.pageLikeCount ?? 0;
    if (likes > MAX_PAGE_LIKES) continue; // skip big/top brands

    const cats = (ad.pageCategories || []).join(" ");
    const linkHost = host(ad.linkUrl);
    const isWhatsApp = ad.ctaType === "WHATSAPP_MESSAGE";
    const looksBrand =
      BRAND_CATEGORY.test(cats) || isWhatsApp || (linkHost ? !BAD_LINK_HOST.has(linkHost) : false);
    if (!looksBrand) continue;

    const key = pageUrl.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Prioritise: WhatsApp CTA (easiest reach) > smaller audience.
    const priority = (isWhatsApp ? 1000 : 0) + Math.max(0, MAX_PAGE_LIKES - likes) / 1000;
    scored.push({ url: pageUrl, priority });
  }

  return scored
    .sort((a, b) => b.priority - a.priority)
    .slice(0, cap)
    .map((s) => s.url);
}

export function cityFromAddress(address?: string | null): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const i = parts.findIndex((p) => /^india$/i.test(p));
  if (i > 0) return parts[i - 1].replace(/\d{6}/, "").trim() || null;
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

export interface PageItem {
  pageName?: string | null;
  title?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp_number?: string | null;
  wa_number?: string | null;
  followers?: number | null;
  likes?: number | null;
  category?: string | null;
  categories?: string[] | null;
  ad_status?: string | null;
  address?: string | null;
  pageUrl?: string | null;
  instagram?: { url?: string | null } | null;
}

/** Map Facebook Pages scraper items into raw shapes ready for normalizeBatch. */
export function pagesToRaw(pages: PageItem[]): Record<string, unknown>[] {
  return pages.map((p) => ({
    company: p.title || p.pageName,
    website: p.website,
    phone: p.phone,
    whatsapp: p.whatsapp_number || p.wa_number || p.phone,
    email: p.email,
    followers: p.followers ?? p.likes ?? null,
    category: p.category || (Array.isArray(p.categories) ? p.categories.find((c) => c !== "Page") : null),
    city: cityFromAddress(p.address),
    ads_running: true, // sourced from active advertisers
    instagram_url: p.instagram?.url || null,
    facebook_url: p.pageUrl || null,
  }));
}

/** Keep only leads we can actually contact (the "easily reachable" rule). */
export function onlyReachable<T extends { whatsapp: string | null; phone: string | null; email: string | null }>(
  leads: T[]
): T[] {
  return leads.filter((l) => l.whatsapp || l.phone || l.email);
}
