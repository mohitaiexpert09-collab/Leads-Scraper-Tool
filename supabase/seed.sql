-- Optional seed data for Supabase. Run AFTER schema.sql.
-- Inserts a few sample leads + the default outreach templates so the dashboard
-- isn't empty on first login. Safe to skip in production.

insert into message_templates (name, channel, body) values
('WhatsApp · First touch', 'whatsapp',
 'Hi {{founder}}, loved what {{company}} is building! We help D2C brands cut COD RTO by 20-40% using AI-driven address & intent checks. Worth a quick chat?'),
('Email · Case study', 'email',
 E'Hi {{founder}},\n\nWe recently helped a {{category}} brand drop RTO from 32% to 19% in 6 weeks. Sharing the breakdown — open to a 15-min call this week?\n\nBest,\nTeam'),
('DM · Instagram follow-up', 'dm',
 'Hey {{company}} team! Following up — running ads but losing margin to COD returns? We fix exactly that. Can I send a 1-pager?')
on conflict do nothing;

insert into leads (founder_name, company, website, instagram_url, phone, whatsapp, email, city, category, source, followers, ads_running, tier, score, status, dedupe_key)
values
('Riya Mehta','Kurti Junction','https://kurtijunction.in','https://instagram.com/kurtijunction','9810012345','919810012345','founder@kurtijunction.in','Jaipur','Women''s Clothing Brand','instagram',84000,true,1,100,'new','site:kurtijunction.in'),
('Priya Sharma','Glow Theory','https://glowtheory.in','https://instagram.com/glowtheory','9899911223','919899911223','founder@glowtheory.in','Delhi','Cosmetics','instagram',156000,true,1,100,'replied','site:glowtheory.in'),
('Meera Iyer','Bloom Skincare','https://bloomskincare.in','https://instagram.com/bloomskincare','9840012398','919840012398','founder@bloomskincare.in','Chennai','Skincare','instagram',290000,true,1,100,'won','site:bloomskincare.in')
on conflict (dedupe_key) do nothing;
