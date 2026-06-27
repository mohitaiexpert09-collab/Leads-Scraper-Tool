-- D2C Lead Scraper & CRM — Supabase schema
-- Run this in Supabase SQL Editor (Dashboard → SQL → New query).

create extension if not exists "pgcrypto";

-- ---------- enums ----------
do $$ begin
  create type lead_source as enum ('google_maps','instagram','facebook','manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum ('new','contacted','follow_up','replied','qualified','won','lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_type as enum ('note','call','message_sent','reply','status_change');
exception when duplicate_object then null; end $$;

-- ---------- profiles (linked to auth.users) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text default 'member',
  created_at timestamptz default now()
);

-- ---------- leads ----------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  founder_name text,
  company text,
  website text,
  instagram_url text,
  facebook_url text,
  linkedin_url text,
  phone text,
  whatsapp text,
  email text,
  city text,
  category text,
  source lead_source not null default 'manual',
  followers integer,
  ads_running boolean,
  tier smallint not null default 4 check (tier between 1 and 4),
  score integer not null default 0,
  status lead_status not null default 'new',
  owner_id uuid references auth.users(id) on delete set null,
  notes text,
  raw_json jsonb,
  dedupe_key text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists leads_tier_idx on leads(tier);
create index if not exists leads_status_idx on leads(status);
create index if not exists leads_source_idx on leads(source);
create index if not exists leads_created_idx on leads(created_at desc);

-- ---------- activities ----------
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  type activity_type not null default 'note',
  channel text,
  body text,
  created_by text,
  created_at timestamptz default now()
);
create index if not exists activities_lead_idx on activities(lead_id, created_at desc);

-- ---------- follow_ups ----------
create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  due_date timestamptz not null,
  status text not null default 'pending' check (status in ('pending','done')),
  note text,
  assignee text,
  created_at timestamptz default now()
);
create index if not exists follow_ups_due_idx on follow_ups(due_date) where status = 'pending';

-- ---------- message_templates ----------
create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null default 'whatsapp',
  body text not null,
  created_at timestamptz default now()
);

-- ---------- scrape_runs (audit) ----------
create table if not exists scrape_runs (
  id uuid primary key default gen_random_uuid(),
  source lead_source not null,
  actor_id text,
  params jsonb,
  leads_found integer default 0,
  status text default 'completed',
  started_at timestamptz default now()
);

-- ---------- updated_at trigger ----------
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists leads_updated_at on leads;
create trigger leads_updated_at before update on leads
  for each row execute function set_updated_at();

-- ---------- auto-create profile on signup ----------
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Row Level Security ----------
-- Any authenticated team member can read/write all CRM data.
alter table leads enable row level security;
alter table activities enable row level security;
alter table follow_ups enable row level security;
alter table message_templates enable row level security;
alter table scrape_runs enable row level security;
alter table profiles enable row level security;

do $$
declare t text;
begin
  foreach t in array array['leads','activities','follow_ups','message_templates','scrape_runs'] loop
    execute format('drop policy if exists "team_all_%1$s" on %1$s;', t);
    execute format(
      'create policy "team_all_%1$s" on %1$s for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

drop policy if exists "own_profile_read" on profiles;
create policy "own_profile_read" on profiles for select to authenticated using (true);
drop policy if exists "own_profile_write" on profiles;
create policy "own_profile_write" on profiles for update to authenticated using (auth.uid() = id);
