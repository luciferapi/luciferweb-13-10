alter table public.wallet_withdrawal_requests
  add column owner_response text,
  add column payment_reference text,
  add column owner_note text,
  add column processed_at timestamptz,
  add constraint wallet_withdrawal_owner_response_length
    check (owner_response is null or char_length(trim(owner_response)) between 3 and 1000),
  add constraint wallet_withdrawal_payment_reference_length
    check (payment_reference is null or char_length(trim(payment_reference)) between 3 and 120),
  add constraint wallet_withdrawal_owner_note_length
    check (owner_note is null or char_length(trim(owner_note)) between 3 and 1000);

drop function public.owner_set_withdrawal_status(uuid, uuid, text, boolean);

create function public.owner_set_withdrawal_status(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_status text,
  p_external_payment_confirmed boolean,
  p_owner_response text,
  p_payment_reference text,
  p_owner_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_owner_response text := nullif(pg_catalog.btrim(p_owner_response), '');
  v_payment_reference text := nullif(pg_catalog.btrim(p_payment_reference), '');
  v_owner_note text := nullif(pg_catalog.btrim(p_owner_note), '');
begin
  if not exists (
    select 1 from public.owner_admins as admins
    where admins.user_id = p_actor_user_id
  ) then
    return 'unauthorized';
  end if;
  if p_status not in ('paid', 'rejected') then
    return 'invalid_status';
  end if;
  if v_owner_response is null or char_length(v_owner_response) < 3 or char_length(v_owner_response) > 1000 then
    return 'invalid_response';
  end if;
  if v_owner_note is not null and char_length(v_owner_note) > 1000 then
    return 'invalid_owner_note';
  end if;
  if p_status = 'paid' and not p_external_payment_confirmed then
    return 'payment_confirmation_required';
  end if;
  if p_status = 'paid'
    and (v_payment_reference is null or char_length(v_payment_reference) < 3 or char_length(v_payment_reference) > 120) then
    return 'invalid_payment_reference';
  end if;
  if p_status = 'rejected' and v_payment_reference is not null then
    return 'invalid_payment_reference';
  end if;

  update public.wallet_withdrawal_requests as withdrawals
  set status = p_status,
      updated_at = pg_catalog.now(),
      owner_response = v_owner_response,
      payment_reference = case when p_status = 'paid' then v_payment_reference else null end,
      owner_note = v_owner_note,
      processed_at = pg_catalog.now()
  where withdrawals.request_id = p_request_id
    and withdrawals.status = 'pending'
  returning withdrawals.user_id into v_user_id;
  if not found then
    return 'not_pending';
  end if;

  insert into public.owner_audit_logs (actor_user_id, action, subject_user_id, details)
  values (
    p_actor_user_id,
    case when p_status = 'paid' then 'withdrawal.marked_paid' else 'withdrawal.rejected' end,
    v_user_id,
    pg_catalog.jsonb_build_object(
      'requestId', p_request_id,
      'externalPaymentConfirmed', p_external_payment_confirmed,
      'paymentReference', v_payment_reference,
      'ownerResponse', v_owner_response,
      'ownerNote', v_owner_note
    )
  );
  return 'updated';
end;
$$;

revoke all on function public.owner_set_withdrawal_status(uuid, uuid, text, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.owner_set_withdrawal_status(uuid, uuid, text, boolean, text, text, text) to service_role;