import type { Activity, FollowUp, Lead, LeadSource, LeadStatus, MessageTemplate } from "./types";
import { scoreLead } from "./scoring";
import { toIndianE164 } from "./whatsapp";

/** In-memory store used in demo mode (no Supabase). Persists for the server process. */
interface Store {
  leads: Lead[];
  activities: Activity[];
  followUps: FollowUp[];
  templates: MessageTemplate[];
}

const SEED_BRANDS: Array<{
  founder: string;
  company: string;
  city: string;
  category: string;
  source: LeadSource;
  followers: number | null;
  ads: boolean | null;
  status: LeadStatus;
  hasEmail?: boolean;
  hasSite?: boolean;
  phone?: string | null;
}> = [
  { founder: "Riya Mehta", company: "Kurti Junction", city: "Jaipur", category: "Women's Clothing Brand", source: "instagram", followers: 84000, ads: true, status: "new", hasEmail: true, hasSite: true, phone: "9810012345" },
  { founder: "Arjun Nair", company: "SoleMate Footwear", city: "Mumbai", category: "Footwear store", source: "google_maps", followers: 23000, ads: true, status: "contacted", hasSite: true, phone: "9820098765" },
  { founder: "Priya Sharma", company: "Glow Theory", city: "Delhi", category: "Cosmetics", source: "instagram", followers: 156000, ads: true, status: "replied", hasEmail: true, hasSite: true, phone: "9899911223" },
  { founder: "Karthik Reddy", company: "FitFuel Nutrition", city: "Bengaluru", category: "Supplements", source: "facebook", followers: 41000, ads: true, status: "qualified", hasEmail: true, hasSite: true, phone: "9844455667" },
  { founder: "Sneha Patel", company: "Anaya Jewels", city: "Surat", category: "Jewellery", source: "instagram", followers: 67000, ads: true, status: "follow_up", hasSite: true, phone: "9925511234" },
  { founder: "Vikram Singh", company: "UrbanThread", city: "Delhi", category: "Apparel", source: "google_maps", followers: 12000, ads: false, status: "new", hasSite: true, phone: "9871123456" },
  { founder: "Meera Iyer", company: "Bloom Skincare", city: "Chennai", category: "Skincare", source: "instagram", followers: 290000, ads: true, status: "won", hasEmail: true, hasSite: true, phone: "9840012398" },
  { founder: "Rohan Gupta", company: "GadgetGrid", city: "Pune", category: "Electronics accessories", source: "facebook", followers: 18000, ads: true, status: "contacted", hasSite: true, phone: "9011223344" },
  { founder: "Ananya Das", company: "Saree Stories", city: "Kolkata", category: "Clothing brand", source: "instagram", followers: 54000, ads: false, status: "new", hasSite: true, phone: "9831122334" },
  { founder: "Imran Khan", company: "StepUp Sneakers", city: "Hyderabad", category: "Footwear", source: "google_maps", followers: 9000, ads: true, status: "follow_up", hasSite: true, phone: "9700011223" },
  { founder: "Divya Rao", company: "Velvet & Co", city: "Bengaluru", category: "Fashion accessories", source: "instagram", followers: 33000, ads: true, status: "replied", hasEmail: true, hasSite: true, phone: "9845567788" },
  { founder: "Sahil Verma", company: "PureRoots Wellness", city: "Delhi", category: "Nutrition", source: "facebook", followers: 76000, ads: true, status: "new", hasEmail: true, hasSite: true, phone: "9818822334" },
  { founder: "Tanya Kapoor", company: "Mode Boutique", city: "Ludhiana", category: "Boutique", source: "google_maps", followers: 4000, ads: false, status: "new", hasSite: true, phone: "9876500011" },
  { founder: "Aditya Joshi", company: "Trailblaze Bags", city: "Mumbai", category: "Bags", source: "instagram", followers: 21000, ads: true, status: "contacted", hasSite: true, phone: "9820011223" },
  { founder: "Nisha Menon", company: "Lush Locks", city: "Kochi", category: "Beauty", source: "instagram", followers: 112000, ads: true, status: "qualified", hasEmail: true, hasSite: true, phone: "9846612345" },
  { founder: "Rahul Bose", company: "DeskCraft", city: "Noida", category: "Home decor", source: "google_maps", followers: null, ads: false, status: "new", hasSite: false, phone: null },
  { founder: "Pooja Agarwal", company: "Tiny Threads Kids", city: "Indore", category: "Kids clothing", source: "facebook", followers: 28000, ads: true, status: "follow_up", hasEmail: true, hasSite: true, phone: "9926611223" },
  { founder: "Manish Tiwari", company: "Aroma Candles", city: "Jaipur", category: "Home decor", source: "instagram", followers: 15000, ads: false, status: "new", hasSite: true, phone: "9829911223" },
  { founder: "Kavya Pillai", company: "Zest Activewear", city: "Bengaluru", category: "Fitness apparel", source: "instagram", followers: 88000, ads: true, status: "lost", hasEmail: true, hasSite: true, phone: "9845512399" },
  { founder: "Deepak Chauhan", company: "WatchVault", city: "Delhi", category: "Watches", source: "google_maps", followers: 6000, ads: true, status: "new", hasSite: true, phone: "9810099887" },
  { founder: "Shruti Desai", company: "Bandhani Bazaar", city: "Ahmedabad", category: "Clothing", source: "instagram", followers: 47000, ads: false, status: "contacted", hasSite: true, phone: "9925599887" },
  { founder: "Aman Bhatia", company: "FlexFit Gear", city: "Chandigarh", category: "Fitness", source: "facebook", followers: 35000, ads: true, status: "replied", hasEmail: true, hasSite: true, phone: "9815523456" },
  { founder: "Ritika Sen", company: "Petal & Pearl", city: "Kolkata", category: "Accessories", source: "instagram", followers: 19000, ads: true, status: "new", hasSite: true, phone: "9831199887" },
  { founder: "Gaurav Malhotra", company: "Nomad Footwear", city: "Mumbai", category: "Footwear", source: "google_maps", followers: 62000, ads: true, status: "qualified", hasEmail: true, hasSite: true, phone: "9820077665" },
];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function buildSeed(): Store {
  const leads: Lead[] = SEED_BRANDS.map((b, i) => {
    const website = b.hasSite ? `https://${slug(b.company)}.in` : null;
    const email = b.hasEmail ? `founder@${slug(b.company)}.in` : null;
    const instagram = b.source === "instagram" ? `https://instagram.com/${slug(b.company)}` : null;
    const facebook = b.source === "facebook" ? `https://facebook.com/${slug(b.company)}` : null;
    const whatsapp = toIndianE164(b.phone);
    const { score, tier } = scoreLead({
      adsRunning: b.ads,
      category: b.category,
      followers: b.followers,
      phone: b.phone,
      whatsapp,
      website,
      email,
    });
    const created = daysAgo(i % 7);
    return {
      id: `demo-${i + 1}`,
      founder_name: b.founder,
      company: b.company,
      website,
      instagram_url: instagram,
      facebook_url: facebook,
      linkedin_url: null,
      phone: b.phone ?? null,
      whatsapp,
      email,
      city: b.city,
      category: b.category,
      source: b.source,
      followers: b.followers,
      ads_running: b.ads,
      tier,
      score,
      status: b.status,
      owner_id: null,
      notes: null,
      raw_json: null,
      created_at: created,
      updated_at: created,
    };
  });

  const activities: Activity[] = [];
  const followUps: FollowUp[] = [];
  leads.forEach((l, i) => {
    activities.push({
      id: `act-${i}-c`,
      lead_id: l.id,
      type: "note",
      channel: null,
      body: `Imported from ${l.source} · ${l.category}`,
      created_by: "system",
      created_at: l.created_at,
    });
    if (["contacted", "replied", "qualified", "won", "lost", "follow_up"].includes(l.status)) {
      activities.push({
        id: `act-${i}-m`,
        lead_id: l.id,
        type: "message_sent",
        channel: "whatsapp",
        body: "Sent intro about cutting RTO on COD orders.",
        created_by: "you",
        created_at: daysAgo(Math.max(0, (i % 5) - 1)),
      });
    }
    if (["replied", "qualified", "won"].includes(l.status)) {
      activities.push({
        id: `act-${i}-r`,
        lead_id: l.id,
        type: "reply",
        channel: "whatsapp",
        body: "Interested — asked for pricing and case study.",
        created_by: l.founder_name ?? "lead",
        created_at: daysAgo(i % 3),
      });
    }
    if (l.status === "follow_up") {
      followUps.push({
        id: `fu-${i}`,
        lead_id: l.id,
        due_date: daysAgo(i % 2 === 0 ? 1 : -2), // some overdue, some upcoming
        status: "pending",
        note: "Send case study + book call",
        assignee: "you",
        created_at: l.created_at,
      });
    }
  });

  const templates: MessageTemplate[] = [
    {
      id: "tpl-1",
      name: "WhatsApp · First touch",
      channel: "whatsapp",
      body: "Hi {{founder}}, loved what {{company}} is building! We help D2C brands cut COD RTO by 20-40% using AI-driven address & intent checks. Worth a quick chat?",
      created_at: daysAgo(10),
    },
    {
      id: "tpl-2",
      name: "Email · Case study",
      channel: "email",
      body: "Hi {{founder}},\n\nWe recently helped a {{category}} brand drop RTO from 32% to 19% in 6 weeks. Sharing the breakdown — open to a 15-min call this week?\n\nBest,\nTeam",
      created_at: daysAgo(10),
    },
    {
      id: "tpl-3",
      name: "DM · Instagram follow-up",
      channel: "dm",
      body: "Hey {{company}} team! Following up — running ads but losing margin to COD returns? We fix exactly that. Can I send a 1-pager?",
      created_at: daysAgo(10),
    },
  ];

  return { leads, activities, followUps, templates };
}

const g = globalThis as unknown as { __demoStore?: Store };
export function demoStore(): Store {
  if (!g.__demoStore) g.__demoStore = buildSeed();
  return g.__demoStore;
}
