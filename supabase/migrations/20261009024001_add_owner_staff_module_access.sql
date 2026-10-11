alter table public.owner_admins
  add column role text not null default 'admin'
    check (role in ('co_owner', 'admin', 'customer_support')),
  add column allowed_modules text[] not null default '{}'::text[];

update public.owner_admins
set allowed_modules = array[
  'projects', 'apis', 'users', 'referrals', 'wallet', 'payments', 'support',
  'escalations', 'trading', 'analytics', 'enhancements', 'banners',
  'advertisements', 'broadcasts', 'reports'
]
where cardinality(allowed_modules) = 0;

create or replace function public.owner_set_staff_access(
  p_actor_user_id uuid,
  p_email text,
  p_role text,
  p_allowed_modules text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.auth_users%rowtype;
  v_modules text[] := coalesce(p_allowed_modules, array[]::text[]);
  v_valid_modules constant text[] := array[
    'projects', 'apis', 'users', 'referrals', 'wallet', 'payments',
    'support', 'escalations', 'trading', 'analytics', 'enhancements',
    'banners', 'advertisements', 'broadcasts', 'reports'
  ];
  v_previous_role text;
begin
  if not exists (
    select 1 from public.auth_users as actor
    where actor.id = p_actor_user_id
      and lower(actor.email) = 'kspgpraveen157@gmail.com'
  ) then
    return pg_catalog.jsonb_build_object('status', 'unauthorized');
  end if;
  if p_role is null or p_role not in ('co_owner', 'admin', 'customer_support') then
    return pg_catalog.jsonb_build_object('status', 'invalid_role');
  end if;
  if p_email is null or pg_catalog.btrim(p_email) = '' then
    return pg_catalog.jsonb_build_object('status', 'invalid_email');
  end if;
  if cardinality(v_modules) > cardinality(v_valid_modules)
    or not (v_modules <@ v_valid_modules)
    or cardinality(v_modules) <> (
      select count(distinct modules.module_slug)
      from pg_catalog.unnest(v_modules) as modules(module_slug)
    )
    or 'admins' = any(v_modules) then
    return pg_catalog.jsonb_build_object('status', 'invalid_modules');
  end if;

  select * into v_target
  from public.auth_users as users
  where lower(users.email) = lower(pg_catalog.btrim(p_email))
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('status', 'user_not_found');
  end if;
  if lower(v_target.email) = 'kspgpraveen157@gmail.com' then
    return pg_catalog.jsonb_build_object('status', 'protected_owner');
  end if;
  if v_target.is_blocked then
    return pg_catalog.jsonb_build_object('status', 'user_blocked');
  end if;

  select admins.role into v_previous_role
  from public.owner_admins as admins
  where admins.user_id = v_target.id;

  insert into public.owner_admins (user_id, added_by, role, allowed_modules)
  values (v_target.id, p_actor_user_id, p_role, v_modules)
  on conflict (user_id) do update
  set added_by = excluded.added_by,
      role = excluded.role,
      allowed_modules = excluded.allowed_modules;

  insert into public.owner_audit_logs (actor_user_id, action, subject_user_id, details)
  values (
    p_actor_user_id,
    case when v_previous_role is null then 'staff.access_granted' else 'staff.access_updated' end,
    v_target.id,
    pg_catalog.jsonb_build_object(
      'email', v_target.email,
      'role', p_role,
      'modules', v_modules
    )
  );

  return pg_catalog.jsonb_build_object('status', 'saved', 'user_id', v_target.id);
end;
$$;

create or replace function public.owner_remove_staff_access(
  p_actor_user_id uuid,
  p_target_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_email text;
begin
  if not exists (
    select 1 from public.auth_users as actor
    where actor.id = p_actor_user_id
      and lower(actor.email) = 'kspgpraveen157@gmail.com'
  ) then
    return 'unauthorized';
  end if;
  if p_actor_user_id = p_target_user_id then
    return 'cannot_remove_self';
  end if;

  select users.email into v_target_email
  from public.auth_users as users
  where users.id = p_target_user_id;
  if not found then
    return 'user_not_found';
  end if;
  if lower(v_target_email) = 'kspgpraveen157@gmail.com' then
    return 'protected_owner';
  end if;

  delete from public.owner_admins as admins
  where admins.user_id = p_target_user_id;
  if not found then
    return 'not_staff';
  end if;

  delete from public.auth_owner_login_otps as otps
  where otps.user_id = p_target_user_id;
  delete from public.auth_sessions as sessions
  where sessions.user_id = p_target_user_id;

  insert into public.owner_audit_logs (actor_user_id, action, subject_user_id, details)
  values (
    p_actor_user_id,
    'staff.access_removed',
    p_target_user_id,
    pg_catalog.jsonb_build_object('email', v_target_email)
  );
  return 'removed';
end;
$$;

drop function public.owner_invite_admin(uuid, text);
drop function public.owner_revoke_admin(uuid, uuid);

revoke all on function public.owner_set_staff_access(uuid, text, text, text[]) from public, anon, authenticated;
revoke all on function public.owner_remove_staff_access(uuid, uuid) from public, anon, authenticated;
grant execute on function public.owner_set_staff_access(uuid, text, text, text[]) to service_role;
grant execute on function public.owner_remove_staff_access(uuid, uuid) to service_role;