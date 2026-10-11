drop function public.auth_request_owner_login_otp(text, uuid, text, timestamptz, timestamptz);

create function public.auth_request_owner_login_otp(
  p_email text,
  p_user_id uuid,
  p_otp_hash text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_otp public.auth_owner_login_otps%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 0));

  if not exists (
    select 1 from public.auth_users as users
    where users.id = p_user_id and users.email = v_email
  ) then
    return jsonb_build_object('status', 'missing');
  end if;

  select * into v_otp
  from public.auth_owner_login_otps as otps
  where otps.email = v_email
  for update;

  if found and v_otp.resend_after > pg_catalog.now() then
    return jsonb_build_object(
      'status', 'cooldown',
      'retry_after_seconds',
      pg_catalog.ceil(extract(epoch from (v_otp.resend_after - pg_catalog.now())))::integer
    );
  end if;

  insert into public.auth_owner_login_otps (
    email, user_id, otp_hash, expires_at, resend_after, attempts
  ) values (
    v_email,
    p_user_id,
    p_otp_hash,
    p_expires_at,
    pg_catalog.now() + interval '120 seconds',
    0
  )
  on conflict (email) do update
  set user_id = excluded.user_id,
      otp_hash = excluded.otp_hash,
      expires_at = excluded.expires_at,
      resend_after = excluded.resend_after,
      attempts = 0;

  return jsonb_build_object('status', 'sent');
end;
$$;

revoke all on function public.auth_request_owner_login_otp(text, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.auth_request_owner_login_otp(text, uuid, text, timestamptz)
  to service_role;