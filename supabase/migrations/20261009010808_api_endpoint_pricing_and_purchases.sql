alter table public.api_endpoints
  add column price_paise bigint not null default 0
  check (price_paise = 0 or price_paise >= 100);

create table public.api_endpoint_purchases (
  order_id text primary key,
  payment_id text unique,
  user_id uuid not null references public.auth_users(id) on delete cascade,
  endpoint_id text not null,
  endpoint_name text not null,
  amount_paise bigint not null check (amount_paise >= 100),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled', 'expired', 'failed')),
  purchased_at timestamptz not null default now()
);

create index api_endpoint_purchases_user_date_idx
  on public.api_endpoint_purchases(user_id, purchased_at desc);
create index api_endpoint_purchases_user_endpoint_paid_idx
  on public.api_endpoint_purchases(user_id, endpoint_id)
  where status = 'paid';

alter table public.api_endpoint_purchases enable row level security;

revoke all on public.api_endpoint_purchases from public, anon, authenticated;
grant all on public.api_endpoint_purchases to service_role;