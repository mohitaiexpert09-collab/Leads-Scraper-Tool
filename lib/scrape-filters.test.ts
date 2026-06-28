import { describe, it, expect } from "vitest";
import { pickAdvertisers, pagesToRaw, shopifyToRaw, cityFromAddress, onlyReachable, type AdItem } from "./scrape-filters";
import { normalizeBatch } from "./normalize";

describe("pickAdvertisers", () => {
  const ads: AdItem[] = [
    { pageName: "Amazon India", pageUrl: "https://facebook.com/AmazonIN/", pageLikeCount: 10000000, pageCategories: ["Retail company"] },
    { pageName: "Mamaearth", pageUrl: "https://facebook.com/mamaearth/", pageLikeCount: 500000, pageCategories: ["Health & Beauty"] },
    { pageName: "Blba Kurti", pageUrl: "https://facebook.com/blbakurti/", pageLikeCount: 2634, pageCategories: ["Clothing (Brand)"] },
    { pageName: "Surat Kurtis", pageUrl: "https://facebook.com/suratkurtis/", pageLikeCount: 8000, ctaType: "WHATSAPP_MESSAGE", pageCategories: ["Clothing (Brand)"] },
    { pageName: "Big Brand", pageUrl: "https://facebook.com/bigbrand/", pageLikeCount: 900000, pageCategories: ["Clothing (Brand)"] },
  ];

  it("drops marketplaces, big-funded brands, and oversized pages", () => {
    const out = pickAdvertisers(ads);
    expect(out).not.toContain("https://facebook.com/AmazonIN/"); // marketplace
    expect(out).not.toContain("https://facebook.com/mamaearth/"); // funded brand
    expect(out).not.toContain("https://facebook.com/bigbrand/"); // 900k > 150k cap
  });

  it("keeps small founder brands and prioritises WhatsApp-CTA advertisers", () => {
    const out = pickAdvertisers(ads);
    expect(out).toContain("https://facebook.com/blbakurti/");
    expect(out[0]).toBe("https://facebook.com/suratkurtis/"); // WhatsApp CTA ranked first
  });
});

describe("cityFromAddress", () => {
  it("extracts the city before 'India'", () => {
    expect(cityFromAddress("D80, Ramashram Marg, Jaipur, India, 302012")).toBe("Jaipur");
    expect(cityFromAddress(null)).toBeNull();
  });
});

describe("pagesToRaw + normalize", () => {
  it("maps a FB page into a reachable, ads-running lead", () => {
    const raw = pagesToRaw([
      {
        title: "Blba Kurti",
        website: "http://blbakurti.com/",
        phone: "+91 81044 95484",
        email: "theblbakurtis@gmail.com",
        likes: 2634,
        categories: ["Page", "Clothing (Brand)"],
        ad_status: "This Page is currently running ads.",
        address: "Plot 87A, Jaipur, India, 302020",
        pageUrl: "https://facebook.com/blbakurti/",
      },
    ]);
    const [lead] = normalizeBatch(raw, "facebook");
    expect(lead.company).toBe("Blba Kurti");
    expect(lead.whatsapp).toBe("918104495484");
    expect(lead.ads_running).toBe(true);
    expect(lead.city).toBe("Jaipur");
    expect(lead.tier).toBeLessThanOrEqual(2); // ads + clothing + reachable => hot
  });
});

describe("shopifyToRaw + normalize", () => {
  it("maps a Shopify store into a reachable, India-located lead", () => {
    const raw = shopifyToRaw(
      [
        {
          name: "Jaipur Kurti Co",
          websiteUrl: "https://jaipurkurti.com",
          myshopifyDomain: "jaipurkurti.myshopify.com",
          contacts: [
            { type: "email", value: "hello@jaipurkurti.com" },
            { type: "phone", value: "+91 98765 43210" },
          ],
          address: { city: "Jaipur", country: "India", zip: "302001" },
        },
      ],
      "kurti"
    );
    const [lead] = normalizeBatch(raw, "shopify");
    expect(lead.company).toBe("Jaipur Kurti Co");
    expect(lead.email).toBe("hello@jaipurkurti.com");
    expect(lead.whatsapp).toBe("919876543210");
    expect(lead.city).toBe("Jaipur");
    expect(lead.source).toBe("shopify");
    expect(lead.dedupe_key).toBe("site:jaipurkurti.com");
  });

  it("salvages contacts from a flat emails/phones shape", () => {
    const raw = shopifyToRaw([
      {
        name: "Bandhani Studio",
        websiteUrl: "https://bandhanistudio.in",
        emails: ["care@bandhanistudio.in"],
        phones: ["09812345678"],
      },
    ]);
    const [lead] = normalizeBatch(raw, "shopify");
    expect(lead.email).toBe("care@bandhanistudio.in");
    expect(lead.whatsapp).toBe("919812345678");
  });

  it("drops marketplaces and big/funded brands by name", () => {
    expect(shopifyToRaw([{ name: "Nykaa Fashion", websiteUrl: "https://nykaa.com" }])).toHaveLength(0);
    expect(shopifyToRaw([{ name: "Mamaearth", websiteUrl: "https://mamaearth.in" }])).toHaveLength(0);
  });
});

describe("onlyReachable", () => {
  it("filters out leads with no contact channel", () => {
    const leads = normalizeBatch(
      [
        { company: "NoContact Co", category: "clothing", followers: 5000, ads_running: true },
        { company: "Reachable Co", category: "clothing", phone: "9876543210", ads_running: true },
      ],
      "facebook"
    );
    const reachable = onlyReachable(leads);
    expect(reachable).toHaveLength(1);
    expect(reachable[0].company).toBe("Reachable Co");
  });
});
