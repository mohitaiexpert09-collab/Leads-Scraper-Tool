# RTO Leads — D2C Lead Scraper & CRM

A full lead-generation + CRM dashboard for an AI automation agency selling
**RTO-reduction** services to Indian D2C founders. Scrape leads from Apify
(Instagram, Google Maps, Facebook), auto-score them **Tier 1–4** by fit and
buying intent, and track the whole funnel: follow-ups, messages, replies, won/lost.

## Quick start (demo mode — zero setup)

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The app runs with **in-memory sample data** so you
can explore every screen immediately. A "Demo mode" banner shows in the header.

## Going live with Supabase (persistent, multi-user)

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.local.example` → `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
3. In the Supabase SQL editor, run [`supabase/schema.sql`](supabase/schema.sql)
   (creates tables + Row-Level Security + auto-profile trigger). Optionally run
   [`supabase/seed.sql`](supabase/seed.sql) for starter templates/leads.
4. Restart `npm run dev`. You'll now get an email/password login (`/login`) and
   all data persists. Invite teammates by having them sign up.

## Getting leads in

You confirmed scraping via your **Claude session's Apify integration** (no token
needed). The workflow:

1. In Claude, run an Apify actor for India D2C (high-RTO) categories:
   - Discovery — **Google Maps** `compass/crawler-google-places`
     (e.g. `"clothing brand Jaipur"`, `"footwear store Mumbai"`).
   - Enrich — **Instagram** `apify/instagram-profile-scraper` (brand handles).
   - Enrich + ad signal — **Facebook** `apify/facebook-pages-scraper`.
2. Download the dataset (JSON or CSV).
3. Go to **Import**, paste/upload it, review the normalized + tier-scored preview,
   and click **Import**. Duplicates (by website/Instagram/phone) are skipped.

Prefer automation later? Add `APIFY_TOKEN` to `.env.local` and use the runners in
[`lib/apify.ts`](lib/apify.ts), or POST datasets to `POST /api/ingest` from n8n.

## Tier scoring

Defined in [`lib/scoring.ts`](lib/scoring.ts) (pure + unit-tested). Signals:
running paid ads, high-RTO category (apparel/footwear/beauty/etc.), follower
sweet spot (10k–500k), and reachability. Thresholds: **T1 ≥ 70, T2 ≥ 50,
T3 ≥ 30, else T4**; a lead with no contact channel is capped at T4. Tune the
weights and re-run `npm test`.

## Screens

Overview (KPIs + charts) · Leads (filterable table) · Lead detail (contacts,
activity timeline, log outreach, schedule follow-up) · Pipeline (drag-and-drop
kanban) · Follow-ups (overdue/today/upcoming) · Import · Templates · Settings.

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm test` | Run scoring/normalize unit tests |

## Automated scraping (Scrape Now + daily)

The app can run the whole pipeline itself — **Meta Ad Library → filter to small,
reachable, founder-led Indian D2C brands → Facebook Pages enrichment (WhatsApp,
phone, email) → Tier 1–4 score → store**. Because a full scrape takes 2–4 min
(longer than serverless limits), runs start asynchronously and an **Apify webhook**
delivers the results back for storage, so it works on any Vercel plan.

Enable it with these env vars (locally in `.env.local` and in Vercel):

| Var | Why |
|---|---|
| `APIFY_TOKEN` | Lets the app launch the scrapers. |
| `SUPABASE_SERVICE_ROLE_KEY` | Lets cron/webhooks store leads (no logged-in user). Keep secret. |
| `CRON_SECRET` | Secures the `/api/scrape/run` (cron) + `/api/scrape/hook` (webhook) endpoints. |
| `NEXT_PUBLIC_SITE_URL` | Your deployed URL, so Apify webhooks can call back. |

- **Scrape Now button** — Settings → "Scrape now" (any logged-in user).
- **Daily auto-scrape** — `vercel.json` runs `/api/scrape/run` at 04:00 UTC (~9:30 AM IST).
- Tune target niches and the small-brand filter in
  [lib/scrape-filters.ts](lib/scrape-filters.ts) (e.g. `MAX_PAGE_LIKES`, `NICHE_QUERIES`).

## Deploy (Vercel)

Push to GitHub, import the repo in Vercel, add the env vars above (plus the two
`NEXT_PUBLIC_SUPABASE_*`), deploy. The cron in `vercel.json` is registered
automatically. `/api/ingest` also works as a public ingestion webhook.

## Notes

- Scraped phone numbers aren't guaranteed to be WhatsApp-registered — we build
  `wa.me` links you verify on first contact.
- LinkedIn isn't a selected source; `linkedin_url` is filled only when a scraper
  surfaces it, otherwise add it manually.
- Respect platform usage limits and Indian DND/consent norms when messaging.
