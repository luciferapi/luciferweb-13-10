create table public.site_maintenance_pages (
  id uuid primary key default gen_random_uuid(),
  path text not null unique check (char_length(btrim(path)) between 1 and 255),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  message text not null check (char_length(btrim(message)) between 1 and 500),
  image_url text check (image_url is null or char_length(btrim(image_url)) between 1 and 2000),
  is_enabled boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index site_maintenance_pages_active_order_idx
  on public.site_maintenance_pages (sort_order, created_at)
  where is_enabled;

alter table public.site_maintenance_pages enable row level security;
revoke all on public.site_maintenance_pages from public, anon, authenticated;
grant all on public.site_maintenance_pages to service_role;
