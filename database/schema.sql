-- BrandShield AI: database schema (Supabase / PostgreSQL)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Then run seed.sql (sample brand kit) and, after creating demo users, demo_users.sql.

-- ---------- profiles (one row per login user, holds the role) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('creator', 'manager', 'reviewer', 'admin')),
  created_at timestamptz not null default now()
);

-- ---------- brand knowledge base ----------
create table if not exists public.brand_rules (
  id text primary key,                      -- e.g. G-7
  title text not null,
  body text not null,
  category text not null check (category in ('tone', 'terminology', 'claims', 'visual', 'accessibility', 'legal', 'other')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.facts (
  id text primary key,                      -- e.g. F-4
  fact_key text not null unique,            -- machine name, e.g. price_6_pack
  label text not null,                      -- human name, e.g. "Price of 6-bottle pack"
  value text not null,                      -- as shown to people, e.g. "Rs 1,199"
  numeric_value numeric,                    -- used for exact number matching (1199, 15)
  unit text,                                -- INR, percent, days, text
  source text not null,                     -- where this fact comes from
  owner text not null,                      -- who is responsible for it
  valid_from date not null default current_date,
  valid_until date,                         -- after this date the fact counts as expired
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.terminology (
  id bigint generated always as identity primary key,
  banned_term text not null,
  preferred_term text,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- content and review ----------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  title text not null,
  channel text not null check (channel in ('instagram', 'email', 'website', 'ad', 'blog', 'other')),
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'in_review', 'changes_requested', 'approved')),
  version integer not null default 1,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_versions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.content_items(id) on delete cascade,
  version integer not null,
  body text not null,
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (item_id, version)
);

create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.content_items(id) on delete cascade,
  version integer not null,
  claim text not null,                      -- the exact text that was flagged
  claim_type text,                          -- price, discount, superlative, health, term, ...
  status text not null check (status in ('verified', 'contradicted', 'unsupported', 'needs_human', 'rule_violation', 'expired_fact', 'mismatch')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  source_id text,                           -- cited rule (G-x) or fact (F-x)
  explanation text not null,
  suggested_fix text,
  origin text not null check (origin in ('rule', 'fact', 'ai', 'campaign')),
  decision text not null default 'open' check (decision in ('open', 'accepted', 'dismissed')),
  decision_reason text,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists findings_item_idx on public.findings (item_id);

-- which approved facts a content item uses (powers the "Impact view")
create table if not exists public.item_fact_links (
  item_id uuid not null references public.content_items(id) on delete cascade,
  fact_id text not null references public.facts(id) on delete cascade,
  primary key (item_id, fact_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.content_items(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.content_items(id) on delete cascade,
  version integer not null,
  reviewer_id uuid not null references public.profiles(id),
  decision text not null check (decision in ('approved', 'changes_requested')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- keep updated_at fresh ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists facts_touch on public.facts;
create trigger facts_touch before update on public.facts
  for each row execute function public.touch_updated_at();

drop trigger if exists items_touch on public.content_items;
create trigger items_touch before update on public.content_items
  for each row execute function public.touch_updated_at();

-- ---------- role helper used by the security rules ----------
create or replace function public.current_app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ---------- row-level security: who can do what ----------
alter table public.profiles enable row level security;
alter table public.brand_rules enable row level security;
alter table public.facts enable row level security;
alter table public.terminology enable row level security;
alter table public.campaigns enable row level security;
alter table public.content_items enable row level security;
alter table public.content_versions enable row level security;
alter table public.findings enable row level security;
alter table public.item_fact_links enable row level security;
alter table public.comments enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_log enable row level security;

-- everyone signed in can read everything in this single-organisation demo
do $$
declare t text;
begin
  foreach t in array array['profiles','brand_rules','facts','terminology','campaigns','content_items',
                           'content_versions','findings','item_fact_links','comments','approvals','audit_log']
  loop
    execute format('drop policy if exists "read all" on public.%I', t);
    execute format('create policy "read all" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

-- only admins change the brand knowledge base
do $$
declare t text;
begin
  foreach t in array array['brand_rules','facts','terminology']
  loop
    execute format('drop policy if exists "admin write" on public.%I', t);
    execute format('create policy "admin write" on public.%I for all to authenticated
                    using (public.current_app_role() = ''admin'')
                    with check (public.current_app_role() = ''admin'')', t);
  end loop;
end $$;

-- campaigns and content
drop policy if exists "create campaign" on public.campaigns;
create policy "create campaign" on public.campaigns for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "create item" on public.content_items;
create policy "create item" on public.content_items for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "update item" on public.content_items;
create policy "update item" on public.content_items for update to authenticated
  using (created_by = auth.uid() or public.current_app_role() in ('manager', 'reviewer', 'admin'))
  with check (true);

drop policy if exists "create version" on public.content_versions;
create policy "create version" on public.content_versions for insert to authenticated
  with check (created_by = auth.uid());

-- findings are created by the review service (service role bypasses these rules);
-- signed-in users may record their decision on a finding
drop policy if exists "decide finding" on public.findings;
create policy "decide finding" on public.findings for update to authenticated
  using (true) with check (true);

-- comments, approvals, audit log
drop policy if exists "write comment" on public.comments;
create policy "write comment" on public.comments for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "write approval" on public.approvals;
create policy "write approval" on public.approvals for insert to authenticated
  with check (reviewer_id = auth.uid() and public.current_app_role() in ('manager', 'reviewer', 'admin'));

drop policy if exists "write audit" on public.audit_log;
create policy "write audit" on public.audit_log for insert to authenticated
  with check (actor_id = auth.uid());

-- ---------- permissions for the Supabase API roles ----------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
