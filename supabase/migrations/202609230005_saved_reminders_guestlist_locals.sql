alter table public.profiles
  alter column notification_preferences set default '{"invites":true,"sales":true,"transfers":true,"earnings":true,"updates":true,"reminders":true,"followers":true,"mentions":true,"news":true}'::jsonb;

update public.profiles
set notification_preferences = notification_preferences || '{"reminders":true}'::jsonb
where not (notification_preferences ? 'reminders');

create table if not exists public.event_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table if not exists public.event_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  reminder_kind text not null check (reminder_kind in ('24h', '3h')),
  push_sent boolean not null default false,
  email_sent boolean not null default false,
  email_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, event_id, reminder_kind)
);

create table if not exists public.event_guestlist_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  guest_name text not null check (char_length(guest_name) between 2 and 100),
  guest_email text,
  plus_ones smallint not null default 0 check (plus_ones between 0 and 10),
  notes text not null default '' check (char_length(notes) <= 500),
  status text not null default 'invited' check (status in ('invited','arrived','cancelled')),
  access_token uuid not null unique default gen_random_uuid(),
  arrived_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists event_guestlist_user_unique on public.event_guestlist_entries(event_id, user_id) where user_id is not null and status <> 'cancelled';
create index if not exists event_guestlist_event_idx on public.event_guestlist_entries(event_id, status, guest_name);

create table if not exists public.local_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  locality text not null check (char_length(locality) between 2 and 100),
  status text not null default 'pending' check (status in ('pending','verified','rejected','expired')),
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_local_access_rules (
  event_id uuid primary key references public.events(id) on delete cascade,
  enabled boolean not null default false,
  locality text not null,
  benefit_type text not null default 'percentage' check (benefit_type in ('free','percentage')),
  discount_percent smallint not null default 0 check (discount_percent between 0 and 100),
  capacity integer check (capacity is null or capacity > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((benefit_type = 'free' and discount_percent = 100) or (benefit_type = 'percentage' and discount_percent between 1 and 99))
);

create table if not exists public.local_access_redemptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  benefit_type text not null check (benefit_type in ('free','percentage')),
  discount_percent smallint not null,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

alter table public.event_saves enable row level security;
alter table public.event_reminder_deliveries enable row level security;
alter table public.event_guestlist_entries enable row level security;
alter table public.local_memberships enable row level security;
alter table public.event_local_access_rules enable row level security;
alter table public.local_access_redemptions enable row level security;

create policy "users manage saved events" on public.event_saves for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users read own reminder deliveries" on public.event_reminder_deliveries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "hosts manage guestlist" on public.event_guestlist_entries for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.host_id = (select auth.uid())))
  with check (exists (select 1 from public.events e where e.id = event_id and e.host_id = (select auth.uid())));
create policy "guests read own guestlist access" on public.event_guestlist_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "users read own local membership" on public.local_memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy "users apply for local membership" on public.local_memberships for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy "users update pending local application" on public.local_memberships for update to authenticated
  using (user_id = (select auth.uid()) and status = 'pending')
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy "public reads active local access" on public.event_local_access_rules for select to authenticated, anon using (enabled);
create policy "hosts manage local access" on public.event_local_access_rules for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.host_id = (select auth.uid())))
  with check (exists (select 1 from public.events e where e.id = event_id and e.host_id = (select auth.uid())));
create policy "users read own local redemptions" on public.local_access_redemptions for select to authenticated
  using (user_id = (select auth.uid()));

create index if not exists event_saves_event_idx on public.event_saves(event_id, created_at);
create index if not exists reminder_due_lookup_idx on public.event_reminder_deliveries(event_id, reminder_kind);
create index if not exists local_memberships_locality_idx on public.local_memberships(lower(locality), status);

create or replace function public.reserve_local_free_ticket(p_user_id uuid, p_event_id uuid, p_ticket_type_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare selected public.ticket_types%rowtype; rule public.event_local_access_rules%rowtype; new_order uuid; new_ticket uuid;
begin
  select * into rule from public.event_local_access_rules where event_id = p_event_id and enabled and benefit_type = 'free' for update;
  if not found then raise exception 'Free local access is not available'; end if;
  if rule.capacity is not null and rule.redeemed_count >= rule.capacity then raise exception 'Local allocation is full'; end if;
  if not exists (select 1 from public.local_memberships m where m.user_id = p_user_id and m.status = 'verified' and lower(m.locality) = lower(rule.locality) and (m.expires_at is null or m.expires_at > now())) then raise exception 'Verified local membership required'; end if;
  if exists (select 1 from public.local_access_redemptions where event_id = p_event_id and user_id = p_user_id) then raise exception 'Local benefit already used'; end if;
  select * into selected from public.ticket_types where id = p_ticket_type_id and event_id = p_event_id and active for update;
  if not found then raise exception 'Ticket type not found'; end if;
  if selected.sold_count + selected.reserved_count >= selected.quantity then raise exception 'Event is full'; end if;
  insert into public.orders (buyer_id,event_id,payment_status,currency,subtotal_minor,platform_fee_minor,total_minor) values (p_user_id,p_event_id,'free',selected.currency,0,0,0) returning id into new_order;
  insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_minor) values (new_order,selected.id,1,0);
  update public.ticket_types set sold_count = sold_count + 1 where id = selected.id;
  insert into public.tickets(order_id,event_id,ticket_type_id,owner_id) values (new_order,p_event_id,selected.id,p_user_id) returning id into new_ticket;
  insert into public.local_access_redemptions(event_id,user_id,order_id,benefit_type,discount_percent) values (p_event_id,p_user_id,new_order,'free',100);
  update public.event_local_access_rules set redeemed_count = redeemed_count + 1, updated_at = now() where event_id = p_event_id;
  return new_ticket;
end; $$;
revoke all on function public.reserve_local_free_ticket(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.reserve_local_free_ticket(uuid,uuid,uuid) to service_role;

create or replace function public.create_discounted_pending_order(
  p_buyer_id uuid, p_event_id uuid, p_ticket_type_id uuid, p_quantity integer,
  p_unit_price_minor integer, p_platform_fee_minor integer, p_affiliate_user_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare selected public.ticket_types%rowtype; rule public.event_local_access_rules%rowtype; new_order uuid;
begin
  if p_quantity < 1 or p_quantity > 10 then raise exception 'Invalid quantity'; end if;
  select * into rule from public.event_local_access_rules where event_id = p_event_id and enabled and benefit_type = 'percentage' for update;
  if not found then raise exception 'Local discount is not available'; end if;
  if rule.capacity is not null and rule.redeemed_count >= rule.capacity then raise exception 'Local allocation is full'; end if;
  if not exists (select 1 from public.local_memberships m where m.user_id = p_buyer_id and m.status = 'verified' and lower(m.locality) = lower(rule.locality) and (m.expires_at is null or m.expires_at > now())) then raise exception 'Verified local membership required'; end if;
  if exists (select 1 from public.local_access_redemptions where event_id = p_event_id and user_id = p_buyer_id) then raise exception 'Local benefit already used'; end if;
  select * into selected from public.ticket_types where id = p_ticket_type_id and event_id = p_event_id and active and price_minor > 0 for update;
  if not found then raise exception 'Ticket type not found'; end if;
  if selected.sold_count + selected.reserved_count + p_quantity > selected.quantity then raise exception 'Not enough tickets remain'; end if;
  if p_unit_price_minor <> round(selected.price_minor * (100 - rule.discount_percent) / 100.0) then raise exception 'Invalid local price'; end if;
  update public.ticket_types set reserved_count = reserved_count + p_quantity where id = selected.id;
  insert into public.orders(buyer_id,event_id,payment_status,currency,subtotal_minor,platform_fee_minor,total_minor,affiliate_user_id)
  values(p_buyer_id,p_event_id,'pending',selected.currency,p_unit_price_minor*p_quantity,p_platform_fee_minor,p_unit_price_minor*p_quantity+p_platform_fee_minor,p_affiliate_user_id) returning id into new_order;
  insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_minor) values(new_order,selected.id,p_quantity,p_unit_price_minor);
  insert into public.local_access_redemptions(event_id,user_id,order_id,benefit_type,discount_percent) values(p_event_id,p_buyer_id,new_order,'percentage',rule.discount_percent);
  update public.event_local_access_rules set redeemed_count = redeemed_count + 1, updated_at = now() where event_id = p_event_id;
  return new_order;
end; $$;
revoke all on function public.create_discounted_pending_order(uuid,uuid,uuid,integer,integer,integer,uuid) from public, anon, authenticated;
grant execute on function public.create_discounted_pending_order(uuid,uuid,uuid,integer,integer,integer,uuid) to service_role;
