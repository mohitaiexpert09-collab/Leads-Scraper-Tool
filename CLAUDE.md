# RTO Leads — D2C Lead Scraper & CRM

**Goal:** Find Indian D2C founders, score by fit for our RTO-reduction service, track outreach. ~100 leads/day.

## Pipeline
1. **Scrape** (Apify, run in Claude session): Google Maps `compass/crawler-google-places` (discovery by category × city), Instagram `apify/instagram-profile-scraper` (enrich), Facebook `apify/facebook-pages-scraper` (enrich + ad status).
2. **Normalize** (`lib/normalize.ts`): map raw items → name, company, website, phone, WhatsApp (`wa.me/91…`), IG/FB/LinkedIn, followers, ads, category. Dedupe by website/IG/phone.
3. **Score Tier 1–4** (`lib/scoring.ts`): +ads, +high-RTO category, +followers 10k–500k, +reachable. T1≥70/T2≥50/T3≥30/else T4. No contact = T4.
4. **Import**: paste/upload dataset on `/import`, or POST to `/api/ingest`.
5. **Track**: pipeline New→Contacted→Follow-up→Replied→Qualified→Won/Lost. Log messages/replies, schedule follow-ups, use templates. Outreach is manual.

## Stack
Next.js 15 (App Router, TS) · Tailwind v4 · Supabase (Postgres+Auth+RLS) · Vercel.

## Run
- `npm run dev` → http://localhost:3000. Works in **demo mode** (in-memory sample data) with no setup.
- Real mode: copy `.env.local.example` → `.env.local`, add Supabase URL + anon key, run `supabase/schema.sql` (+ optional `seed.sql`). Optional `APIFY_TOKEN` for auto-scraping.
- `npm test` runs scoring/normalize unit tests.

## Key files
- `lib/scoring.ts` — tier weights (tune here)
- `lib/normalize.ts` — Apify → Lead mapping + dedupe
- `lib/apify.ts` — actor IDs + token-ready runners
- `lib/data.ts` / `lib/actions.ts` — reads / mutations (Supabase or demo)
- `app/(app)/*` — the 7 dashboard screens
- `supabase/schema.sql` — tables + RLS

## Notes
- Indian phones → E.164 (`lib/whatsapp.ts`); WhatsApp links prefill template 1.
- New source: extend `detectSource` in `lib/normalize.ts` + `ACTORS` in `lib/apify.ts`.
- Respect platform limits & Indian DND/consent norms.
