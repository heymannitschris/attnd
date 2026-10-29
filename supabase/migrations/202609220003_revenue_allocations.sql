-- Snapshot each paid ticket order's host/co-host split at the moment of sale.
create table if not exists public.revenue_allocations (
  order_id uuid not null references public.orders(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('host', 'cohost')),
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  available_at timestamptz not null,
  status text not null default 'earned' check (status in ('earned', 'reversed')),
  created_at timestamptz not null default now(),
  primary key (order_id, user_id)
);
create index if not exists revenue_allocations_user_available_idx on public.revenue_allocations(user_id, role, currency, available_at);
alter table public.revenue_allocations enable row level security;
create policy "users read own revenue allocations" on public.revenue_allocations for select to authenticated using (user_id = (select auth.uid()));
alter table public.orders add column if not exists stripe_payment_intent_id text unique;

-- Historical orders have no recorded co-host agreement at sale time, so credit the host.
insert into public.revenue_allocations (order_id, event_id, user_id, role, amount_minor, currency, available_at)
select o.id, o.event_id, e.host_id, 'host', greatest(0, o.subtotal_minor - coalesce(ac.amount_minor, 0)), o.currency,
  greatest(coalesce(o.paid_at, o.created_at) + interval '7 days', coalesce(e.ends_at, e.starts_at, o.created_at) + interval '7 days')
from public.orders o
join public.events e on e.id = o.event_id
left join public.affiliate_commissions ac on ac.order_id = o.id and ac.status <> 'reversed'
where o.payment_status = 'paid'
on conflict (order_id, user_id) do nothing;

alter table public.payout_requests drop constraint if exists payout_requests_source_check;
alter table public.payout_requests add constraint payout_requests_source_check check (source in ('affiliate', 'host', 'cohost'));

create or replace function public.finalize_paid_order(p_order_id uuid, p_stripe_session_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  item record;
  collaborator record;
  paid_order public.orders%rowtype;
  event_row public.events%rowtype;
  affiliate_amount integer := 0;
  distributable integer;
  collaborator_amount integer;
  collaborator_total integer := 0;
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
  for collaborator in select user_id, revenue_share_percent from public.event_cohosts where event_id = paid_order.event_id and status = 'accepted' and revenue_share_percent > 0 order by user_id loop
    collaborator_amount := least(distributable - collaborator_total, round(distributable * collaborator.revenue_share_percent / 100.0));
    collaborator_total := collaborator_total + collaborator_amount;
    insert into public.revenue_allocations(order_id,event_id,user_id,role,amount_minor,currency,available_at)
    values (paid_order.id,paid_order.event_id,collaborator.user_id,'cohost',collaborator_amount,paid_order.currency,release_at);
  end loop;
  if collaborator_total > distributable then raise exception 'Co-host shares exceed order revenue'; end if;
  insert into public.revenue_allocations(order_id,event_id,user_id,role,amount_minor,currency,available_at)
  values (paid_order.id,paid_order.event_id,event_row.host_id,'host',distributable - collaborator_total,paid_order.currency,release_at);
end; $$;
revoke all on function public.finalize_paid_order(uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_paid_order(uuid, text) to service_role;

create or replace function public.reverse_paid_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare item record;
begin
  update public.orders set payment_status = 'refunded' where id = p_order_id and payment_status = 'paid';
  if not found then return; end if;
  update public.tickets set status = 'refunded' where order_id = p_order_id and status <> 'refunded';
  update public.affiliate_commissions set status = 'reversed' where order_id = p_order_id;
  update public.revenue_allocations set status = 'reversed' where order_id = p_order_id;
  for item in select ticket_type_id, quantity from public.order_items where order_id = p_order_id loop
    update public.ticket_types set sold_count = greatest(0, sold_count - item.quantity) where id = item.ticket_type_id;
  end loop;
end; $$;
revoke all on function public.reverse_paid_order(uuid) from public, anon, authenticated;
grant execute on function public.reverse_paid_order(uuid) to service_role;

-- Balance validation and reservation must be atomic across simultaneous requests.
create or replace function public.reserve_payout_request(p_user_id uuid, p_source text, p_currency text, p_amount_minor integer, p_fee_minor integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare earned_minor bigint := 0; reserved_minor bigint := 0; request_id uuid;
begin
  if p_source not in ('affiliate', 'host', 'cohost') or p_currency !~ '^[a-z]{3}$' or p_amount_minor < 5000 or p_fee_minor < 0 or p_fee_minor >= p_amount_minor then
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
