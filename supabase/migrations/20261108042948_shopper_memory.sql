-- Persistent shopper memory: what a returning shopper told the bot on
-- earlier visits (preferences only) and the products it showed them.
-- Keyed by an anonymous per-browser visitor id; only the chat function
-- (service role) reads or writes it.

alter table public.businesses
  add column if not exists shopper_memory boolean not null default true;

alter table public.conversations
  add column if not exists visitor_id text
    check (visitor_id is null or visitor_id ~ '^[A-Za-z0-9_-]{8,100}$');

create table if not exists public.shopper_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  visitor_id text not null check (visitor_id ~ '^[A-Za-z0-9_-]{8,100}$'),
  facts text[] not null default '{}'
    check (cardinality(facts) <= 10),
  product_ids uuid[] not null default '{}'
    check (cardinality(product_ids) <= 6),
  visits integer not null default 1 check (visits >= 0),
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id, visitor_id)
);

create index if not exists shopper_profiles_last_seen_idx
  on public.shopper_profiles (last_seen);

alter table public.shopper_profiles enable row level security;
-- No policies: browsers never read profiles directly.
revoke all on public.shopper_profiles from anon, authenticated;

-- Profiles not seen for 90 days are forgotten.
create or replace function public.purge_stale_shopper_profiles()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.shopper_profiles
    where last_seen < now() - interval '90 days'
    returning 1
  )
  select count(*)::integer from gone;
$$;
revoke all on function public.purge_stale_shopper_profiles() from public, anon, authenticated;
