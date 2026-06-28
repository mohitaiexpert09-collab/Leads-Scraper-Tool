# RTO Leads — D2C Lead Scraper & CRM

**Goal:** Find Indian D2C founders, score by fit for our RTO-reduction service, track outreach. ~100 leads/day.

## Pipeline
1. **Scrape**: auto via `lib/scrape.ts` (daily cron + Scrape Now) — Shopify `clearpath/shopify-store-leads` (India niches → emails/phones, primary volume) + Meta Ad Library → FB Pages enrich.
2. **Normalize** (`lib/normalize.ts`): raw → company, website, phone, WhatsApp (`wa.me/91…`), IG/FB/LinkedIn, followers, ads, category. Dedupe by website/IG/phone.
3. **Score Tier 1–4** (`lib/scoring.ts`): +ads, +high-RTO category, +followers sweet spot, +reachable. T1≥70/T2≥50/T3≥30/else T4. No contact = T4.
4. **Import**: paste/upload dataset on `/import`, or POST to `/api/ingest`.
5. **Track**: New→Contacted→Follow-up→Replied→Qualified→Won/Lost. One-tap Send WhatsApp/Email auto-logs; Interested/Not interested dispositions; follow-ups, templates.

## Stack
Next.js 15 (App Router, TS) · Tailwind v4 · Supabase · Vercel.

## Run
- `npm run dev` → http://localhost:3000. Works in **demo mode** (in-memory sample data) with no setup.
- Real mode: fill `.env.local` (see `.env.local.example`), run `supabase/schema.sql`. Set Apify + service-role + cron + site-url (+ Airtable) vars to auto-scrape.
- `npm test` runs scoring/normalize/filter unit tests.

## Key files
- `lib/scoring.ts` tier weights · `lib/normalize.ts` raw→Lead + dedupe
- `lib/scrape.ts` / `lib/scrape-filters.ts` — auto pipeline + niche/brand filters
- `lib/apify.ts` actor IDs · `lib/airtable.ts` Airtable mirror · `lib/actions.ts` mutations
- `app/(app)/*` screens · `supabase/schema.sql` tables + RLS

## Notes
- Indian phones → E.164 (`lib/whatsapp.ts`); WhatsApp links prefill template 1.
- New source: extend `detectSource` (`lib/normalize.ts`) + `ACTORS` (`lib/apify.ts`).
- Airtable mirror: set `AIRTABLE_TOKEN`+`AIRTABLE_BASE_ID`; backfill `scripts/sync-airtable.ts`.
- Respect platform limits & Indian DND/consent norms.
