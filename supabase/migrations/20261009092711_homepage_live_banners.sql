create table public.owner_live_banners (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(btrim(message)) between 1 and 240),
  link_url text check (link_url is null or char_length(btrim(link_url)) between 1 and 500),
  is_enabled boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index owner_live_banners_active_order_idx
  on public.owner_live_banners (sort_order, created_at)
  where is_enabled;

alter table public.owner_live_banners enable row level security;
revoke all on public.owner_live_banners from public, anon, authenticated;
grant all on public.owner_live_banners to service_role;