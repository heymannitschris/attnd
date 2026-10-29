create table if not exists public.event_staff (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  role text not null check (role in ('check_in')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (event_id, user_id, role)
);

create index if not exists event_staff_user_idx on public.event_staff(user_id, status, role);
alter table public.event_staff enable row level security;

create policy "staff and hosts read event roles" on public.event_staff for select to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.events where events.id = event_staff.event_id and events.host_id = (select auth.uid())
  )
);

create or replace function public.check_in_ticket(p_qr_token uuid)
returns table(ticket_id uuid, attendee_name text, ticket_status text)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  selected public.tickets%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select t.* into selected from public.tickets t where t.qr_token = p_qr_token for update;
  if not found then raise exception 'Ticket not found'; end if;
  if not exists (
    select 1 from public.events e where e.id = selected.event_id and e.host_id = uid
  ) and not exists (
    select 1 from public.event_staff s
    where s.event_id = selected.event_id and s.user_id = uid and s.role = 'check_in' and s.status = 'accepted'
  ) then raise exception 'Not allowed'; end if;
  if selected.status <> 'valid' then raise exception 'Ticket is not valid'; end if;

  update public.tickets set status = 'used' where id = selected.id;
  insert into public.ticket_checkins (ticket_id, event_id, checked_in_by)
  values (selected.id, selected.event_id, uid);
  return query select selected.id, coalesce(selected.attendee_name, 'Guest'), 'used'::text;
end;
$$;

revoke all on function public.check_in_ticket(uuid) from public, anon;
grant execute on function public.check_in_ticket(uuid) to authenticated;
