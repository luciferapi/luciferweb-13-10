alter table public.support_tickets
  add column escalated_at timestamptz,
  add column escalated_by uuid references public.auth_users(id) on delete set null,
  add column escalation_note text
    check (escalation_note is null or char_length(escalation_note) between 3 and 1000);

create index support_tickets_escalated_updated_idx
  on public.support_tickets (updated_at desc)
  where escalated_at is not null;

create or replace function public.owner_forward_support_ticket(
  p_ticket_id uuid,
  p_actor_user_id uuid,
  p_escalation_note text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_customer_id uuid;
begin
  if p_escalation_note is null
    or pg_catalog.char_length(pg_catalog.btrim(p_escalation_note)) < 3
    or pg_catalog.char_length(pg_catalog.btrim(p_escalation_note)) > 1000 then
    return 'invalid_note';
  end if;
  if not exists (
    select 1
    from public.auth_users as actor
    join public.owner_admins as admins on admins.user_id = actor.id
    where actor.id = p_actor_user_id
      and (
        pg_catalog.lower(actor.email) = 'kspgpraveen157@gmail.com'
        or 'support' = any(admins.allowed_modules)
      )
  ) then
    return 'unauthorized';
  end if;

  update public.support_tickets as tickets
  set escalated_at = pg_catalog.now(),
      escalated_by = p_actor_user_id,
      escalation_note = pg_catalog.btrim(p_escalation_note),
      updated_at = pg_catalog.now()
  where tickets.id = p_ticket_id
    and tickets.escalated_at is null
  returning tickets.user_id into v_customer_id;

  if not found then
    if exists (select 1 from public.support_tickets as tickets where tickets.id = p_ticket_id) then
      return 'already_forwarded';
    end if;
    return 'not_found';
  end if;

  insert into public.owner_audit_logs (actor_user_id, action, subject_user_id, details)
  values (
    p_actor_user_id,
    'support.ticket_forwarded',
    v_customer_id,
    pg_catalog.jsonb_build_object('ticket_id', p_ticket_id, 'escalation_note', pg_catalog.btrim(p_escalation_note))
  );
  return 'forwarded';
end;
$$;

revoke all on function public.owner_forward_support_ticket(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.owner_forward_support_ticket(uuid, uuid, text)
  to service_role;