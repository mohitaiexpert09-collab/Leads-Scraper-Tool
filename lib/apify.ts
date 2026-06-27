import type { LeadSource } from "./types";

/**
 * Token-ready Apify client. Until you add an APIFY_TOKEN, leave this unused and
 * import leads via the Import screen (run the actors in your Claude session).
 * When a token is present, these helpers run the actors synchronously and return
 * the raw dataset items, ready for normalizeBatch().
 */

export const ACTORS: Record<Exclude<LeadSource, "manual">, string> = {
  google_maps: "compass~crawler-google-places",
  instagram: "apify~instagram-profile-scraper",
  facebook: "apify~facebook-pages-scraper",
};

const APIFY_BASE = "https://api.apify.com/v2";

export function hasApifyToken(): boolean {
  return Boolean(process.env.APIFY_TOKEN);
}

async function runActorSync(actorId: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set. Add it in Settings to enable auto-scraping.");

  const res = await fetch(
    `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify ${actorId} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as Record<string, unknown>[];
}

// India D2C, high-RTO categories. Tune freely.
export const DEFAULT_DISCOVERY = {
  categories: ["clothing brand", "footwear store", "cosmetics", "fashion accessories"],
  cities: ["Mumbai", "Delhi", "Bengaluru", "Jaipur", "Surat", "Ahmedabad"],
  perSearch: 20,
};

export async function runGoogleMaps(
  searchStrings: string[],
  maxPerSearch = DEFAULT_DISCOVERY.perSearch
) {
  return runActorSync(ACTORS.google_maps, {
    searchStringsArray: searchStrings,
    maxCrawledPlacesPerSearch: maxPerSearch,
    language: "en",
    countryCode: "in",
    scrapeContacts: true,
    scrapeSocialMediaProfiles: { facebook: true, instagram: true, linkedin: true },
  });
}

export async function runInstagram(usernames: string[]) {
  return runActorSync(ACTORS.instagram, { usernames });
}

export async function runFacebook(pageUrls: string[]) {
  return runActorSync(ACTORS.facebook, { startUrls: pageUrls.map((url) => ({ url })) });
}
