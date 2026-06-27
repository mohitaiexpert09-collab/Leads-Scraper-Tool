import type { Tier } from "./types";

/**
 * Tier 1-4 scoring tuned for the RTO-reduction niche.
 *
 * Signal logic (why these matter for selling RTO services to Indian D2C brands):
 *  - ads_running: brand is actively spending => scaling => feels RTO pain & can pay.
 *  - high-RTO category: apparel/footwear/beauty etc. have the worst COD return rates.
 *  - followers sweet spot (10k-500k): big enough to have order volume, small enough
 *    to still be founder-led and reachable.
 *  - reachability: a lead we can actually contact (phone/whatsapp/website) is worth more.
 *
 * Pure function so weights are trivial to tune and unit-test.
 */

export interface ScoreWeights {
  adsRunning: number;
  highRtoCategory: number;
  followersSweet: number;
  followersPartial: number;
  hasPhoneOrWhatsApp: number;
  hasWebsite: number;
  hasEmail: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  adsRunning: 35,
  highRtoCategory: 25,
  followersSweet: 20,
  followersPartial: 8,
  hasPhoneOrWhatsApp: 10,
  hasWebsite: 5,
  hasEmail: 5,
};

// Categories with the highest COD return-to-origin rates in Indian e-commerce.
const HIGH_RTO_KEYWORDS = [
  "apparel",
  "clothing",
  "fashion",
  "footwear",
  "shoe",
  "cloth",
  "wear",
  "boutique",
  "beauty",
  "cosmetic",
  "skincare",
  "makeup",
  "jewel",
  "accessor",
  "bag",
  "watch",
  "electronic",
  "gadget",
  "fitness",
  "supplement",
  "nutrition",
  "home decor",
  "furnishing",
];

export interface ScoreInput {
  adsRunning?: boolean | null;
  category?: string | null;
  followers?: number | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  email?: string | null;
}

export interface ScoreResult {
  score: number; // 0-100
  tier: Tier;
  reasons: string[];
}

export function isHighRtoCategory(category?: string | null): boolean {
  if (!category) return false;
  const c = category.toLowerCase();
  return HIGH_RTO_KEYWORDS.some((k) => c.includes(k));
}

export function scoreLead(
  input: ScoreInput,
  weights: ScoreWeights = DEFAULT_WEIGHTS
): ScoreResult {
  let score = 0;
  const reasons: string[] = [];

  if (input.adsRunning) {
    score += weights.adsRunning;
    reasons.push("Running paid ads (active spender)");
  }

  if (isHighRtoCategory(input.category)) {
    score += weights.highRtoCategory;
    reasons.push("High-RTO category");
  }

  const f = input.followers ?? 0;
  if (f >= 10_000 && f <= 500_000) {
    score += weights.followersSweet;
    reasons.push("Audience in scaling sweet spot (10k-500k)");
  } else if (f > 0) {
    score += weights.followersPartial;
    reasons.push("Has audience (outside ideal range)");
  }

  const reachable = Boolean(input.phone || input.whatsapp);
  if (reachable) {
    score += weights.hasPhoneOrWhatsApp;
    reasons.push("Reachable by phone/WhatsApp");
  }
  if (input.website) {
    score += weights.hasWebsite;
    reasons.push("Has website");
  }
  if (input.email) {
    score += weights.hasEmail;
    reasons.push("Has email");
  }

  score = Math.min(100, Math.round(score));

  // A lead with no contact channel at all can't be worked => cap at Tier 4.
  const noContact = !reachable && !input.email && !input.website;

  let tier: Tier;
  if (noContact) tier = 4;
  else if (score >= 70) tier = 1;
  else if (score >= 50) tier = 2;
  else if (score >= 30) tier = 3;
  else tier = 4;

  return { score, tier, reasons };
}
