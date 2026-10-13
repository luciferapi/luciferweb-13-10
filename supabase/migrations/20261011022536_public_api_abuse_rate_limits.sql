create table public.api_rate_limit_buckets (
  bucket_key text primary key check (bucket_key ~ '^[0-9a-f]{64}$'),
  tokens numeric(12, 6) not null check (tokens >= 0),
  updated_at timestamptz not null,
  expires_at timestamptz not null
);
create index api_rate_limit_buckets_expires_at_idx
  on public.api_rate_limit_buckets (expires_at);

alter table public.api_rate_limit_buckets enable row level security;
revoke all on public.api_rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on public.api_rate_limit_buckets to service_role;

create or replace function public.check_api_rate_limit(
  p_bucket_keys text[],
  p_capacity integer,
  p_refill_seconds integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key text;
  v_tokens numeric;
  v_retry_after integer := 0;
  v_now timestamptz := now();
begin
  if coalesce(array_length(p_bucket_keys, 1), 0) < 1
     or array_length(p_bucket_keys, 1) > 8
     or p_capacity < 1
     or p_capacity > 10000
     or p_refill_seconds < 1
     or p_refill_seconds > 86400
     or exists (
       select 1
       from unnest(p_bucket_keys) as supplied(bucket_key)
       where supplied.bucket_key is null
          or supplied.bucket_key !~ '^[0-9a-f]{64}$'
     ) then
    raise exception 'Invalid API rate-limit parameters'
      using errcode = '22023';
  end if;

  if pg_catalog.random() < 0.015625 then
    with expired as (
      select buckets.bucket_key
      from public.api_rate_limit_buckets as buckets
      where buckets.expires_at <= v_now
      order by buckets.expires_at
      limit 100
    )
    delete from public.api_rate_limit_buckets as buckets
    using expired
    where buckets.bucket_key = expired.bucket_key;
  end if;

  for v_key in
    select distinct supplied.bucket_key
    from unnest(p_bucket_keys) as supplied(bucket_key)
    order by supplied.bucket_key
  loop
    insert into public.api_rate_limit_buckets as buckets (
      bucket_key, tokens, updated_at, expires_at
    ) values (
      v_key, p_capacity, v_now, v_now + interval '1 day'
    )
    on conflict (bucket_key) do update
    set tokens = least(
          p_capacity,
          buckets.tokens
            + greatest(0, extract(epoch from (v_now - buckets.updated_at))
              * p_capacity / p_refill_seconds)
        ),
        updated_at = v_now,
        expires_at = v_now + interval '1 day'
    returning buckets.tokens into v_tokens;

    if v_tokens < 1 then
      v_retry_after := greatest(
        v_retry_after,
        ceil((1 - v_tokens) * p_refill_seconds / p_capacity)::integer
      );
    end if;
  end loop;

  if v_retry_after > 0 then
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', v_retry_after
    );
  end if;

  update public.api_rate_limit_buckets as buckets
  set tokens = greatest(0, buckets.tokens - 1)
  where buckets.bucket_key in (
    select distinct supplied.bucket_key
    from unnest(p_bucket_keys) as supplied(bucket_key)
  );

  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;

revoke all on function public.check_api_rate_limit(text[], integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_api_rate_limit(text[], integer, integer)
  to service_role;