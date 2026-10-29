create or replace function public.check_in_guestlist(p_access_token uuid)
returns table(ticket_id uuid, attendee_name text, ticket_status text)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); selected public.event_guestlist_entries%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select g.* into selected from public.event_guestlist_entries g where g.access_token = p_access_token for update;
  if not found then raise exception 'Guestlist pass not found'; end if;
  if not exists (
    select 1 from public.events e where e.id = selected.event_id and e.host_id = uid
  ) and not exists (
    select 1 from public.event_staff s where s.event_id = selected.event_id and s.user_id = uid and s.role = 'check_in' and s.status = 'accepted'
  ) and not exists (
    select 1 from public.event_team_members m where m.event_id = selected.event_id and m.user_id = uid and m.can_check_in and m.status = 'accepted'
  ) then raise exception 'Not allowed'; end if;
  if selected.status = 'arrived' then raise exception 'Guestlist pass was already checked in'; end if;
  if selected.status <> 'invited' then raise exception 'Guestlist pass is not valid'; end if;
  update public.event_guestlist_entries set status = 'arrived', arrived_at = now() where id = selected.id;
  return query select selected.id, selected.guest_name, 'guestlist'::text;
end; $$;

revoke all on function public.check_in_guestlist(uuid) from public, anon;
grant execute on function public.check_in_guestlist(uuid) to authenticated;
