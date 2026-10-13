create table public.owner_wallet_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.auth_users(id) on delete cascade,
  actor_user_id uuid references public.auth_users(id) on delete set null,
  amount_paise bigint not null check (amount_paise <> 0),
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  created_at timestamptz not null default now()
);

create index owner_wallet_adjustments_user_created_idx
  on public.owner_wallet_adjustments(user_id, created_at desc);

alter table public.owner_wallet_adjustments enable row level security;
revoke all on public.owner_wallet_adjustments from public, anon, authenticated;
grant all on public.owner_wallet_adjustments to service_role;

create or replace function public.get_available_wallet_balance_paise(p_user_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select (
    coalesce((
      select sum(deposits.amount_paise)
      from public.wallet_deposits as deposits
      where deposits.user_id = p_user_id and deposits.status = 'paid'
    ), 0)
    - coalesce((
      select sum(withdrawals.amount_paise)
      from public.wallet_withdrawal_requests as withdrawals
      where withdrawals.user_id = p_user_id and withdrawals.status in ('paid', 'pending')
    ), 0)
    + coalesce((
      select sum(adjustments.amount_paise)
      from public.owner_wallet_adjustments as adjustments
      where adjustments.user_id = p_user_id
    ), 0)
  )::bigint;
$$;

create or replace function public.owner_user_wallet_balances(p_user_ids uuid[])
returns table (user_id uuid, balance_paise bigint)
language sql
stable
set search_path = ''
as $$
  select
    requested.user_id,
    (
      coalesce((
        select sum(deposits.amount_paise)
        from public.wallet_deposits as deposits
        where deposits.user_id = requested.user_id and deposits.status = 'paid'
      ), 0)
      - coalesce((
        select sum(withdrawals.amount_paise)
        from public.wallet_withdrawal_requests as withdrawals
        where withdrawals.user_id = requested.user_id and withdrawals.status in ('paid', 'pending')
      ), 0)
      + coalesce((
        select sum(adjustments.amount_paise)
        from public.owner_wallet_adjustments as adjustments
        where adjustments.user_id = requested.user_id
      ), 0)
    )::bigint
  from (
    select distinct ids.user_id
    from unnest(coalesce(p_user_ids, array[]::uuid[])) as ids(user_id)
  ) as requested;
$$;

create or replace function public.create_wallet_withdrawal_request(
  p_request_id uuid,
  p_withdrawal_id text,
  p_user_id uuid,
  p_amount_paise bigint,
  p_method_type text,
  p_payout_destination text,
  p_request_date date
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_request_count integer;
  v_available_paise bigint;
begin
  perform 1
  from public.auth_users as users
  where users.id = p_user_id
  for update;
  if not found then
    return jsonb_build_object('success', false, 'error_code', 'insufficient_balance');
  end if;

  select count(*)::integer into v_request_count
  from public.wallet_withdrawal_requests as withdrawals
  where withdrawals.user_id = p_user_id
    and withdrawals.request_date = p_request_date;
  if v_request_count >= 4 then
    return jsonb_build_object('success', false, 'error_code', 'daily_limit');
  end if;

  select public.get_available_wallet_balance_paise(p_user_id)
  into v_available_paise;
  if p_amount_paise < 5000 or p_amount_paise > 150000
     or p_amount_paise > v_available_paise then
    return jsonb_build_object('success', false, 'error_code', 'insufficient_balance');
  end if;

  insert into public.wallet_withdrawal_requests (
    request_id, withdrawal_id, user_id, amount_paise, method_type,
    payout_destination, request_date, status
  ) values (
    p_request_id, p_withdrawal_id, p_user_id, p_amount_paise, p_method_type,
    p_payout_destination, p_request_date, 'pending'
  );

  return jsonb_build_object(
    'success', true,
    'withdrawal_id', p_withdrawal_id,
    'remaining_requests', 4 - v_request_count - 1
  );
end;
$$;

create or replace function public.owner_adjust_user_wallet(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_direction text,
  p_amount_paise bigint,
  p_reason text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_available_paise bigint;
  v_signed_amount_paise bigint;
  v_adjustment_id uuid;
  v_reason text := trim(p_reason);
begin
  if not exists (
    select 1 from public.owner_admins as admins
    where admins.user_id = p_actor_user_id
  ) then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  if p_direction is null
     or p_direction not in ('credit', 'debit')
     or p_amount_paise is null
     or p_amount_paise < 1
     or p_amount_paise > 1000000000
     or p_reason is null
     or char_length(v_reason) < 3
     or char_length(v_reason) > 500 then
    return jsonb_build_object('status', 'invalid_adjustment');
  end if;

  perform 1
  from public.auth_users as users
  where users.id = p_target_user_id
  for update;
  if not found then
    return jsonb_build_object('status', 'user_not_found');
  end if;

  select public.get_available_wallet_balance_paise(p_target_user_id)
  into v_available_paise;

  if p_direction = 'debit' and p_amount_paise > v_available_paise then
    return jsonb_build_object('status', 'insufficient_balance');
  end if;

  v_signed_amount_paise := case
    when p_direction = 'credit' then p_amount_paise
    else -p_amount_paise
  end;

  insert into public.owner_wallet_adjustments (
    user_id, actor_user_id, amount_paise, reason
  ) values (
    p_target_user_id, p_actor_user_id, v_signed_amount_paise, v_reason
  )
  returning id into v_adjustment_id;

  insert into public.owner_audit_logs (actor_user_id, action, subject_user_id, details)
  values (
    p_actor_user_id,
    case when p_direction = 'credit' then 'wallet.credited' else 'wallet.debited' end,
    p_target_user_id,
    pg_catalog.jsonb_build_object(
      'adjustmentId', v_adjustment_id,
      'amountPaise', p_amount_paise,
      'direction', p_direction,
      'reason', v_reason
    )
  );

  return jsonb_build_object(
    'status', 'adjusted',
    'adjustment_id', v_adjustment_id,
    'balance_paise', v_available_paise + v_signed_amount_paise
  );
end;
$$;

create or replace function public.owner_wallet_summary()
returns table (
  total_users bigint,
  active_users bigint,
  blocked_users bigint,
  wallet_balance_paise bigint,
  paid_deposits_paise bigint,
  pending_withdrawals_paise bigint,
  paid_withdrawals_paise bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.auth_users),
    (select count(*) from public.auth_users where not is_blocked),
    (select count(*) from public.auth_users where is_blocked),
    coalesce((select sum(amount_paise) from public.wallet_deposits where status = 'paid'), 0)
      - coalesce((select sum(amount_paise) from public.wallet_withdrawal_requests where status in ('paid', 'pending')), 0)
      + coalesce((select sum(amount_paise) from public.owner_wallet_adjustments), 0),
    coalesce((select sum(amount_paise) from public.wallet_deposits where status = 'paid'), 0),
    coalesce((select sum(amount_paise) from public.wallet_withdrawal_requests where status = 'pending'), 0),
    coalesce((select sum(amount_paise) from public.wallet_withdrawal_requests where status = 'paid'), 0);
$$;

revoke all on function public.owner_wallet_summary() from public, anon, authenticated;
grant execute on function public.owner_wallet_summary() to service_role;
revoke all on function public.owner_user_wallet_balances(uuid[]) from public, anon, authenticated;
revoke all on function public.owner_adjust_user_wallet(uuid, uuid, text, bigint, text) from public, anon, authenticated;
grant execute on function public.owner_user_wallet_balances(uuid[]) to service_role;
grant execute on function public.owner_adjust_user_wallet(uuid, uuid, text, bigint, text) to service_role;