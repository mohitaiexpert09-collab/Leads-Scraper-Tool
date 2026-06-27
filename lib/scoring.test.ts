import { describe, it, expect } from "vitest";
import { scoreLead, isHighRtoCategory } from "./scoring";
import { toIndianE164, whatsappLink } from "./whatsapp";
import { normalizeItem, normalizeBatch } from "./normalize";

describe("isHighRtoCategory", () => {
  it("detects apparel/beauty categories", () => {
    expect(isHighRtoCategory("Women's Clothing Brand")).toBe(true);
    expect(isHighRtoCategory("Cosmetics")).toBe(true);
    expect(isHighRtoCategory("Footwear store")).toBe(true);
  });
  it("rejects unrelated/empty categories", () => {
    expect(isHighRtoCategory("Law Firm")).toBe(false);
    expect(isHighRtoCategory(null)).toBe(false);
  });
});

describe("scoreLead", () => {
  it("scores a hot lead as Tier 1", () => {
    const r = scoreLead({
      adsRunning: true,
      category: "clothing brand",
      followers: 50_000,
      phone: "9876543210",
      website: "https://brand.in",
      email: "founder@brand.in",
    });
    expect(r.tier).toBe(1);
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("caps a contactless lead at Tier 4", () => {
    const r = scoreLead({
      adsRunning: true,
      category: "clothing brand",
      followers: 50_000,
      phone: null,
      whatsapp: null,
      website: null,
      email: null,
    });
    expect(r.tier).toBe(4);
  });

  it("places a partial-fit lead in the middle tiers", () => {
    const r = scoreLead({ category: "clothing", followers: 4000, website: "https://x.in" });
    expect(r.tier).toBeGreaterThanOrEqual(2);
    expect(r.tier).toBeLessThanOrEqual(4);
  });
});

describe("toIndianE164", () => {
  it("normalizes common Indian formats", () => {
    expect(toIndianE164("+91 98765 43210")).toBe("919876543210");
    expect(toIndianE164("098765-43210")).toBe("919876543210");
    expect(toIndianE164("9876543210")).toBe("919876543210");
  });
  it("rejects junk", () => {
    expect(toIndianE164("123")).toBeNull();
    expect(toIndianE164(null)).toBeNull();
  });
});

describe("whatsappLink", () => {
  it("builds a wa.me link with prefilled text", () => {
    const link = whatsappLink("9876543210", "Hi there");
    expect(link).toBe("https://wa.me/919876543210?text=Hi%20there");
  });
});

describe("normalize", () => {
  it("normalizes a google maps item", () => {
    const lead = normalizeItem(
      {
        title: "Acme Apparel",
        categoryName: "Clothing store",
        phone: "+91 98765 43210",
        website: "acme.in",
        city: "Mumbai",
        placeId: "abc",
      },
      "google_maps"
    );
    expect(lead.company).toBe("Acme Apparel");
    expect(lead.whatsapp).toBe("919876543210");
    expect(lead.website).toBe("https://acme.in");
    expect(lead.source).toBe("google_maps");
  });

  it("dedupes by website domain across a batch", () => {
    const out = normalizeBatch([
      { title: "A", website: "https://acme.in", categoryName: "clothing", phone: "9876543210" },
      { title: "A dup", website: "http://www.acme.in/", categoryName: "clothing" },
    ]);
    expect(out).toHaveLength(1);
  });
});
