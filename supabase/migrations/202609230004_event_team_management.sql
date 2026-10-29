create table if not exists public.event_team_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  role_title text not null check (char_length(role_title) between 2 and 60),
  compensation_type text not null check (compensation_type in ('percentage', 'fixed')),
  compensation_percent numeric(5,2) check (
    (compensation_type = 'percentage' and compensation_percent > 0 and compensation_percent <= 100)
    or (compensation_type = 'fixed' and compensation_percent is null)
  ),
  fixed_amount_minor integer check (
    (compensation_type = 'fixed' and fixed_amount_minor >= 5000)
    or (compensation_type = 'percentage' and fixed_amount_minor is null)
  ),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  can_check_in boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (event_id, user_id)
);

create index if not exists event_team_members_user_idx on public.event_team_members(user_id, status);
alter table public.event_team_members enable row level security;
create policy "team members and hosts read event team" on public.event_team_members for select to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.events where events.id = event_team_members.event_id and events.host_id = (select auth.uid())
  )
);

alter table public.revenue_allocations drop constraint if exists revenue_allocations_role_check;
alter table public.revenue_allocations add constraint revenue_allocations_role_check check (role in ('host', 'cohost', 'team'));
alter table public.revenue_allocations drop constraint if exists revenue_allocations_pkey;
alter table public.revenue_allocations add primary key (order_id, user_id, role);

alter table public.payout_requests drop constraint if exists payout_requests_source_check;
alter table public.payout_requests add constraint payout_requests_source_check check (source in ('affiliate', 'host', 'cohost', 'team'));

create or replace function public.finalize_paid_order(p_order_id uuid, p_stripe_session_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  item record;
  collaborator record;
  team_member record;
  paid_order public.orders%rowtype;
  event_row public.events%rowtype;
  affiliate_amount integer := 0;
  distributable integer;
  member_amount integer;
  allocated_total integer := 0;
  already_funded integer;
  release_at timestamptz;
begin
  update public.orders set payment_status = 'paid', paid_at = now(), stripe_checkout_session_id = p_stripe_session_id
  where id = p_order_id and payment_status = 'pending' returning * into paid_order;
  if not found then return; end if;

  for item in select * from public.order_items where order_id = p_order_id loop
    update public.ticket_types set sold_count = sold_count + item.quantity, reserved_count = greatest(0, reserved_count - item.quantity)
    where id = item.ticket_type_id and sold_count + item.quantity <= quantity;
    if not found then raise exception 'Ticket inventory exhausted'; end if;
    insert into public.tickets(order_id,event_id,ticket_type_id,owner_id,attendee_name,attendee_email)
    select paid_order.id, paid_order.event_id, item.ticket_type_id, paid_order.buyer_id,
      nullif(trim(concat_ws(' ', attendee.first_name, attendee.last_name)), ''), attendee.email
    from generate_series(1,item.quantity) as seat(position)
    left join public.order_attendees attendee on attendee.order_id = paid_order.id and attendee.position = seat.position;
  end loop;

  select * into event_row from public.events where id = paid_order.event_id;
  if paid_order.affiliate_user_id is not null and paid_order.affiliate_user_id <> paid_order.buyer_id and event_row.affiliate_commission > 0 then
    affiliate_amount := round(paid_order.subtotal_minor * event_row.affiliate_commission / 100.0);
    insert into public.affiliate_commissions(order_id,event_id,affiliate_user_id,host_user_id,rate,amount_minor,currency,available_at)
    values (paid_order.id,paid_order.event_id,paid_order.affiliate_user_id,event_row.host_id,event_row.affiliate_commission,affiliate_amount,paid_order.currency,
      greatest(paid_order.paid_at + interval '7 days', coalesce(event_row.ends_at, event_row.starts_at, paid_order.paid_at) + interval '7 days'))
    on conflict (order_id) do nothing;
    update public.event_invites set status = 'joined'
    where event_id = paid_order.event_id and inviter_id = paid_order.affiliate_user_id and invitee_id = paid_order.buyer_id;
  end if;

  distributable := greatest(0, paid_order.subtotal_minor - affiliate_amount);
  release_at := greatest(paid_order.paid_at + interval '7 days', coalesce(event_row.ends_at, event_row.starts_at, paid_order.paid_at) + interval '7 days');

  for collaborator in
    select user_id, revenue_share_percent from public.event_cohosts
    where event_id = paid_order.event_id and status = 'accepted' and revenue_share_percent > 0 order by user_id
  loop
    member_amount := least(greatest(0, distributable - allocated_total), round(distributable * collaborator.revenue_share_percent / 100.0));
    allocated_total := allocated_total + member_amount;
    insert into public.revenue_allocations(order_id,event_id,user_id,role,amount_minor,currency,available_at)
    values (paid_order.id,paid_order.event_id,collaborator.user_id,'cohost',member_amount,paid_order.currency,release_at);
  end loop;

  for team_member in
    select user_id, compensation_percent from public.event_team_members
    where event_id = paid_order.event_id and status = 'accepted' and compensation_type = 'percentage'
    order by created_at, user_id
  loop
    member_amount := least(greatest(0, distributable - allocated_total), round(distributable * team_member.compensation_percent / 100.0));
    allocated_total := allocated_total + member_amount;
    insert into public.revenue_allocations(order_id,event_id,user_id,role,amount_minor,currency,available_at)
    values (paid_order.id,paid_order.event_id,team_member.user_id,'team',member_amount,paid_order.currency,release_at);
  end loop;

  for team_member in
    select user_id, fixed_amount_minor, currency from public.event_team_members
    where event_id = paid_order.event_id and status = 'accepted' and compensation_type = 'fixed' and currency = paid_order.currency
    order by created_at, user_id
  loop
    select coalesce(sum(amount_minor), 0) into already_funded from public.revenue_allocations
    where event_id = paid_order.event_id and user_id = team_member.user_id and role = 'team' and status = 'earned';
    member_amount := least(
      greatest(0, distributable - allocated_total),
      greatest(0, team_member.fixed_amount_minor - already_funded)
    );
    if member_amount > 0 then
      allocated_total := allocated_total + member_amount;
      insert into public.revenue_allocations(order_id,event_id,user_id,role,amount_minor,currency,available_at)
      values (paid_order.id,paid_order.event_id,team_member.user_id,'team',member_amount,paid_order.currency,release_at);
    end if;
  end loop;

  insert into public.revenue_allocations(order_id,event_id,user_id,role,amount_minor,currency,available_at)
  values (paid_order.id,paid_order.event_id,event_row.host_id,'host',greatest(0, distributable - allocated_total),paid_order.currency,release_at);
end; $$;
revoke all on function public.finalize_paid_order(uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_paid_order(uuid, text) to service_role;

create or replace function public.reserve_payout_request(p_user_id uuid, p_source text, p_currency text, p_amount_minor integer, p_fee_minor integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare earned_minor bigint := 0; reserved_minor bigint := 0; request_id uuid;
begin
  if p_source not in ('affiliate', 'host', 'cohost', 'team') or p_currency !~ '^[a-z]{3}$' or p_amount_minor < 5000 or p_fee_minor < 0 or p_fee_minor >= p_amount_minor then
    raise exception 'Invalid payout request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_source || ':' || p_currency, 0));
  if p_source = 'affiliate' then
    select coalesce(sum(amount_minor), 0) into earned_minor from public.affiliate_commissions
    where affiliate_user_id = p_user_id and currency = p_currency and status in ('available', 'paid') and available_at <= now();
  else
    select coalesce(sum(amount_minor), 0) into earned_minor from public.revenue_allocations
    where user_id = p_user_id and currency = p_currency and role = p_source and status = 'earned' and available_at <= now();
  end if;
  select coalesce(sum(amount_minor), 0) into reserved_minor from public.payout_requests
  where user_id = p_user_id and source = p_source and currency = p_currency and status in ('pending', 'processing', 'paid');
  if p_amount_minor > earned_minor - reserved_minor then raise exception 'Amount exceeds available balance'; end if;
  insert into public.payout_requests(user_id,source,amount_minor,fee_minor,currency,status)
  values (p_user_id,p_source,p_amount_minor,p_fee_minor,p_currency,'processing') returning id into request_id;
  return request_id;
end; $$;
revoke all on function public.reserve_payout_request(uuid, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_payout_request(uuid, text, text, integer, integer) to service_role;

create or replace function public.check_in_ticket(p_qr_token uuid)
returns table(ticket_id uuid, attendee_name text, ticket_status text)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); selected public.tickets%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select t.* into selected from public.tickets t where t.qr_token = p_qr_token for update;
  if not found then raise exception 'Ticket not found'; end if;
  if not exists (
    select 1 from public.events e where e.id = selected.event_id and e.host_id = uid
  ) and not exists (
    select 1 from public.event_staff s where s.event_id = selected.event_id and s.user_id = uid and s.role = 'check_in' and s.status = 'accepted'
  ) and not exists (
    select 1 from public.event_team_members m where m.event_id = selected.event_id and m.user_id = uid and m.can_check_in and m.status = 'accepted'
  ) then raise exception 'Not allowed'; end if;
  if selected.status <> 'valid' then raise exception 'Ticket is not valid'; end if;
  update public.tickets set status = 'used' where id = selected.id;
  insert into public.ticket_checkins (ticket_id, event_id, checked_in_by) values (selected.id, selected.event_id, uid);
  return query select selected.id, coalesce(selected.attendee_name, 'Guest'), 'used'::text;
end; $$;
revoke all on function public.check_in_ticket(uuid) from public, anon;
grant execute on function public.check_in_ticket(uuid) to authenticated;
