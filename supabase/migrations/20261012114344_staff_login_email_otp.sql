create or replace function public.auth_request_owner_login_otp(
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
  v_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
  v_otp public.auth_owner_login_otps%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 0));

  if not exists (
    select 1
    from public.auth_users as users
    where users.id = p_user_id
      and pg_catalog.lower(users.email) = v_email
      and not users.is_blocked
      and (
        v_email = 'kspgpraveen157@gmail.com'
        or exists (
          select 1
          from public.owner_admins as admins
          where admins.user_id = users.id
        )
      )
  ) then
    return pg_catalog.jsonb_build_object('status', 'missing');
  end if;

  select *
  into v_otp
  from public.auth_owner_login_otps as otps
  where otps.email = v_email
  for update;

  if found and v_otp.resend_after > pg_catalog.now() then
    return pg_catalog.jsonb_build_object(
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

  return pg_catalog.jsonb_build_object('status', 'sent');
end;
$$;

create or replace function public.auth_verify_owner_login_otp(
  p_email text,
  p_otp_hash text,
  p_session_token_hash text,
  p_session_expires_at timestamptz,
  p_max_attempts integer
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_otp public.auth_owner_login_otps%rowtype;
  v_user public.auth_users%rowtype;
begin
  select *
  into v_otp
  from public.auth_owner_login_otps as otps
  where otps.email = pg_catalog.lower(pg_catalog.btrim(p_email))
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('status', 'missing');
  end if;

  if v_otp.expires_at <= pg_catalog.now() then
    delete from public.auth_owner_login_otps as otps
    where otps.email = v_otp.email;
    return pg_catalog.jsonb_build_object('status', 'expired');
  end if;

  if v_otp.attempts >= p_max_attempts then
    delete from public.auth_owner_login_otps as otps
    where otps.email = v_otp.email;
    return pg_catalog.jsonb_build_object('status', 'attempts-exceeded');
  end if;

  if v_otp.otp_hash <> p_otp_hash then
    update public.auth_owner_login_otps as otps
    set attempts = otps.attempts + 1
    where otps.email = v_otp.email
    returning * into v_otp;
    if v_otp.attempts >= p_max_attempts then
      delete from public.auth_owner_login_otps as otps
      where otps.email = v_otp.email;
      return pg_catalog.jsonb_build_object('status', 'attempts-exceeded');
    end if;
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;

  select *
  into v_user
  from public.auth_users as users
  where users.id = v_otp.user_id
    and pg_catalog.lower(users.email) = v_otp.email;

  if not found
     or v_user.is_blocked
     or (
       v_otp.email <> 'kspgpraveen157@gmail.com'
       and not exists (
         select 1
         from public.owner_admins as admins
         where admins.user_id = v_user.id
       )
     ) then
    delete from public.auth_owner_login_otps as otps
    where otps.email = v_otp.email;
    return pg_catalog.jsonb_build_object('status', 'missing');
  end if;

  insert into public.auth_sessions (token_hash, user_id, expires_at, auth_method)
  values (p_session_token_hash, v_user.id, p_session_expires_at, 'email_otp');
  delete from public.auth_owner_login_otps as otps
  where otps.email = v_otp.email;

  return pg_catalog.jsonb_build_object('status', 'verified', 'user', pg_catalog.to_jsonb(v_user));
end;
$$;

revoke all on function public.auth_request_owner_login_otp(text, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.auth_request_owner_login_otp(text, uuid, text, timestamptz)
  to service_role;

revoke all on function public.auth_verify_owner_login_otp(text, text, text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.auth_verify_owner_login_otp(text, text, text, timestamptz, integer)
  to service_role;