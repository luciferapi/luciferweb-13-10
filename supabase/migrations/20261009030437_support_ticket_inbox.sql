create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code text not null unique,
  user_id uuid not null references public.auth_users(id) on delete cascade,
  issue_type text not null check (issue_type in ('account', 'payment', 'project', 'api', 'other')),
  order_id text,
  initial_message text not null check (char_length(initial_message) between 10 and 5000),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_on_user', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_user_created_idx
  on public.support_tickets (user_id, created_at desc);
create index support_tickets_status_updated_idx
  on public.support_tickets (status, updated_at desc);

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_user_id uuid references public.auth_users(id) on delete set null,
  author_role text not null check (author_role in ('customer', 'staff')),
  author_name text not null,
  author_email text,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index support_ticket_messages_ticket_created_idx
  on public.support_ticket_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

revoke all on public.support_tickets, public.support_ticket_messages
  from public, anon, authenticated;
grant all on public.support_tickets, public.support_ticket_messages to service_role;

create or replace function public.support_update_ticket(
  p_ticket_id uuid,
  p_actor_user_id uuid,
  p_author_role text,
  p_author_name text,
  p_author_email text,
  p_body text,
  p_status text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_updated_id uuid;
begin
  if p_author_role is null or p_author_role not in ('customer', 'staff') then
    return 'invalid_role';
  end if;
  if p_author_role = 'customer' and p_status is not null then
    return 'invalid_status';
  end if;
  if p_author_role = 'staff' and (
    p_status is null or p_status not in ('open', 'in_progress', 'waiting_on_user', 'resolved')
  ) then
    return 'invalid_status';
  end if;
  if p_body is not null and (pg_catalog.btrim(p_body) = '' or pg_catalog.char_length(p_body) > 5000) then
    return 'invalid_message';
  end if;
  if p_body is not null and (p_author_name is null or pg_catalog.btrim(p_author_name) = '') then
    return 'invalid_message';
  end if;

  if p_author_role = 'customer' then
    update public.support_tickets as tickets
    set status = 'open', updated_at = pg_catalog.now()
    where tickets.id = p_ticket_id and tickets.user_id = p_actor_user_id
    returning tickets.id into v_updated_id;
  else
    update public.support_tickets as tickets
    set status = p_status,
        updated_at = pg_catalog.now()
    where tickets.id = p_ticket_id
    returning tickets.id into v_updated_id;
  end if;
  if not found then
    return 'not_found';
  end if;

  if p_body is not null then
    insert into public.support_ticket_messages (
      ticket_id, author_user_id, author_role, author_name, author_email, body
    )
    values (
      p_ticket_id, p_actor_user_id, p_author_role,
      pg_catalog.left(pg_catalog.btrim(p_author_name), 160),
      nullif(pg_catalog.left(pg_catalog.btrim(p_author_email), 320), ''),
      pg_catalog.btrim(p_body)
    );
  end if;
  return 'updated';
end;
$$;

revoke all on function public.support_update_ticket(uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.support_update_ticket(uuid, uuid, text, text, text, text, text)
  to service_role;