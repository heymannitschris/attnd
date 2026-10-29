alter table public.profiles
  add column if not exists stripe_connect_account_id text unique,
  add column if not exists notification_preferences jsonb not null default '{"invites":true,"sales":true,"transfers":true,"earnings":true,"updates":true,"followers":true,"mentions":true,"news":true}'::jsonb;

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  affiliate_user_id uuid not null references public.profiles(id) on delete cascade,
  host_user_id uuid not null references public.profiles(id) on delete cascade,
  rate smallint not null check (rate between 0 and 50),
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  status text not null default 'available' check (status in ('pending','available','paid','reversed')),
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('affiliate','host')),
  amount_minor integer not null check (amount_minor > 0),
  fee_minor integer not null default 0 check (fee_minor >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  method text not null default 'stripe_connect',
  provider_transfer_id text,
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','cancelled')),
  failure_reason text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios','web')),
  token text not null unique,
  environment text not null default 'production' check (environment in ('development','production')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'Events',
  title text not null,
  body text not null default '',
  href text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid references public.profiles(id) on delete cascade,
  invitee_email text,
  message text not null default '',
  affiliate_user_id uuid references public.profiles(id),
  status text not null default 'sent' check (status in ('sent','seen','joined','declined')),
  email_status text check (email_status in ('queued','sent','failed')),
  email_provider_id text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (invitee_id is not null or invitee_email is not null)
);

create unique index if not exists event_invites_user_unique on public.event_invites(event_id, inviter_id, invitee_id);
create index if not exists affiliate_commissions_user_idx on public.affiliate_commissions(affiliate_user_id, status, created_at desc);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists invites_inviter_idx on public.event_invites(inviter_id, event_id, created_at desc);

create table if not exists public.ticket_transfers (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  recipient_email text,
  message text not null default '',
  claim_token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (recipient_id is not null or recipient_email is not null)
);

create unique index if not exists one_pending_transfer_per_ticket on public.ticket_transfers(ticket_id) where status = 'pending';

alter table public.affiliate_commissions enable row level security;
alter table public.payout_requests enable row level security;
alter table public.push_devices enable row level security;
alter table public.notifications enable row level security;
alter table public.event_invites enable row level security;
alter table public.ticket_transfers enable row level security;

create policy "users read own commissions" on public.affiliate_commissions for select to authenticated using (affiliate_user_id = (select auth.uid()) or host_user_id = (select auth.uid()));
create policy "users read own payouts" on public.payout_requests for select to authenticated using (user_id = (select auth.uid()));
create policy "users manage own devices" on public.push_devices for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users read own notifications" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "users update own notifications" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "invite participants read invites" on public.event_invites for select to authenticated using (inviter_id = (select auth.uid()) or invitee_id = (select auth.uid()));
create policy "users read own transfers" on public.ticket_transfers for select to authenticated using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create or replace function public.create_ticket_transfer(p_ticket_id uuid, p_recipient_id uuid, p_recipient_email text, p_message text)
returns public.ticket_transfers language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); result public.ticket_transfers;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  perform 1 from public.tickets where id = p_ticket_id and owner_id = uid and status = 'valid' for update;
  if not found then raise exception 'Ticket is not transferable'; end if;
  if p_recipient_id = uid then raise exception 'You cannot transfer a ticket to yourself'; end if;
  insert into public.ticket_transfers(ticket_id, sender_id, recipient_id, recipient_email, message)
  values (p_ticket_id, uid, p_recipient_id, nullif(lower(trim(p_recipient_email)), ''), left(coalesce(p_message,''), 300)) returning * into result;
  return result;
end; $$;
revoke all on function public.create_ticket_transfer(uuid, uuid, text, text) from public, anon;
grant execute on function public.create_ticket_transfer(uuid, uuid, text, text) to authenticated;

create or replace function public.accept_ticket_transfer(p_claim_token uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); transfer public.ticket_transfers%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into transfer from public.ticket_transfers where claim_token = p_claim_token and status = 'pending' for update;
  if not found then raise exception 'Transfer not found'; end if;
  if transfer.recipient_id is not null and transfer.recipient_id <> uid then raise exception 'This transfer belongs to another user'; end if;
  update public.tickets set owner_id = uid where id = transfer.ticket_id and owner_id = transfer.sender_id and status = 'valid';
  if not found then raise exception 'Ticket is no longer transferable'; end if;
  update public.ticket_transfers set recipient_id = uid, status = 'accepted', accepted_at = now() where id = transfer.id;
  return transfer.ticket_id;
end; $$;
revoke all on function public.accept_ticket_transfer(uuid) from public, anon;
grant execute on function public.accept_ticket_transfer(uuid) to authenticated;

-- Extend the paid-order finalizer with immutable affiliate commission creation.
create or replace function public.finalize_paid_order(p_order_id uuid, p_stripe_session_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare item record; paid_order public.orders%rowtype; event_row public.events%rowtype;
begin
  update public.orders set payment_status = 'paid', paid_at = now(), stripe_checkout_session_id = p_stripe_session_id
  where id = p_order_id and payment_status = 'pending' returning * into paid_order;
  if not found then return; end if;
  for item in select * from public.order_items where order_id = p_order_id loop
    update public.ticket_types set sold_count = sold_count + item.quantity, reserved_count = greatest(0, reserved_count - item.quantity)
    where id = item.ticket_type_id and sold_count + item.quantity <= quantity;
    if not found then raise exception 'Ticket inventory exhausted'; end if;
    insert into public.tickets(order_id,event_id,ticket_type_id,owner_id)
    select paid_order.id, paid_order.event_id, item.ticket_type_id, paid_order.buyer_id from generate_series(1,item.quantity);
  end loop;
  select * into event_row from public.events where id = paid_order.event_id;
  if paid_order.affiliate_user_id is not null and paid_order.affiliate_user_id <> paid_order.buyer_id and event_row.affiliate_commission > 0 then
    insert into public.affiliate_commissions(order_id,event_id,affiliate_user_id,host_user_id,rate,amount_minor,currency)
    values (paid_order.id,paid_order.event_id,paid_order.affiliate_user_id,event_row.host_id,event_row.affiliate_commission,round(paid_order.subtotal_minor * event_row.affiliate_commission / 100.0),paid_order.currency)
    on conflict (order_id) do nothing;
    update public.event_invites set status = 'joined'
    where event_id = paid_order.event_id and inviter_id = paid_order.affiliate_user_id and invitee_id = paid_order.buyer_id;
  end if;
end; $$;
revoke all on function public.finalize_paid_order(uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_paid_order(uuid, text) to service_role;
