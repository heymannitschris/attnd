create table if not exists public.user_points_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),
  level integer not null default 0 check (level >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount <> 0),
  source text not null,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_points_leaderboard_idx on public.user_points_accounts(level desc, lifetime_earned desc);
create index if not exists user_point_transactions_user_idx on public.user_point_transactions(user_id, created_at desc);

insert into public.user_points_accounts(user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create or replace function public.create_points_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_points_accounts(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_points_account_after_profile on public.profiles;
create trigger create_points_account_after_profile after insert on public.profiles
for each row execute function public.create_points_account();

create or replace function public.award_user_points(
  p_user_id uuid,
  p_amount integer,
  p_source text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare inserted_id uuid;
begin
  if p_user_id is null or p_amount <= 0 or p_amount > 100000 or length(p_idempotency_key) > 240 then return false; end if;
  insert into public.user_points_accounts(user_id) values (p_user_id) on conflict (user_id) do nothing;
  insert into public.user_point_transactions(user_id,amount,source,idempotency_key,metadata)
  values (p_user_id,p_amount,p_source,p_idempotency_key,coalesce(p_metadata,'{}'::jsonb))
  on conflict (idempotency_key) do nothing returning id into inserted_id;
  if inserted_id is null then return false; end if;
  update public.user_points_accounts
  set balance = balance + p_amount, lifetime_earned = lifetime_earned + p_amount, updated_at = now()
  where user_id = p_user_id;
  return true;
end;
$$;

revoke all on function public.award_user_points(uuid,integer,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.award_user_points(uuid,integer,text,text,jsonb) to service_role;

create or replace function public.purchase_next_level()
returns table(balance integer,lifetime_earned integer,level integer,next_level_cost integer)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); account public.user_points_accounts%rowtype; level_cost integer;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  insert into public.user_points_accounts(user_id) values (uid) on conflict (user_id) do nothing;
  select * into account from public.user_points_accounts where user_id = uid for update;
  level_cost := (account.level + 1) * 100;
  if account.balance < level_cost then raise exception 'Not enough points'; end if;
  update public.user_points_accounts
  set balance = user_points_accounts.balance - level_cost, level = user_points_accounts.level + 1, updated_at = now()
  where user_id = uid returning * into account;
  insert into public.user_point_transactions(user_id,amount,source,idempotency_key,metadata)
  values (uid,-level_cost,'level_unlock','level:' || uid::text || ':' || account.level::text,jsonb_build_object('level',account.level));
  return query select account.balance,account.lifetime_earned,account.level,(account.level + 1) * 100;
end;
$$;

revoke all on function public.purchase_next_level() from public,anon;
grant execute on function public.purchase_next_level() to authenticated;

create or replace function public.points_for_order(order_row public.orders)
returns integer language sql immutable set search_path = '' as $$
  select case
    when order_row.payment_status = 'free' then 10
    when order_row.payment_status = 'paid' then 100 + greatest(0, floor(order_row.subtotal_minor::numeric / case lower(order_row.currency)
      when 'usd' then 100 when 'thb' then 3500 when 'eur' then 92 when 'gbp' then 79 when 'aud' then 153 when 'cad' then 139 else 100 end)::integer * 10)
    else 0
  end;
$$;

create or replace function public.award_order_points()
returns trigger language plpgsql security definer set search_path = '' as $$
declare award integer;
begin
  if new.payment_status not in ('free','paid') then return new; end if;
  if tg_op = 'UPDATE' and old.payment_status = new.payment_status then return new; end if;
  award := public.points_for_order(new);
  perform public.award_user_points(new.buyer_id,award,case when new.payment_status = 'free' then 'free_ticket' else 'paid_ticket' end,'order:' || new.id::text,jsonb_build_object('order_id',new.id,'event_id',new.event_id));
  return new;
end;
$$;

drop trigger if exists award_order_points_after_change on public.orders;
create trigger award_order_points_after_change after insert or update of payment_status on public.orders
for each row execute function public.award_order_points();

create or replace function public.award_checkin_points()
returns trigger language plpgsql security definer set search_path = '' as $$
declare attendee uuid;
begin
  select owner_id into attendee from public.tickets where id = new.ticket_id;
  perform public.award_user_points(attendee,500,'event_checkin','checkin:' || new.id::text,jsonb_build_object('event_id',new.event_id,'ticket_id',new.ticket_id));
  return new;
end;
$$;

drop trigger if exists award_checkin_points_after_insert on public.ticket_checkins;
create trigger award_checkin_points_after_insert after insert on public.ticket_checkins
for each row execute function public.award_checkin_points();

create or replace function public.award_guestlist_checkin_points()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'arrived' and (tg_op = 'INSERT' or old.status is distinct from 'arrived') and new.user_id is not null then
    perform public.award_user_points(new.user_id,500,'event_checkin','guestlist-checkin:' || new.id::text,jsonb_build_object('event_id',new.event_id));
  end if;
  return new;
end;
$$;

drop trigger if exists award_guestlist_checkin_points_after_change on public.event_guestlist_entries;
create trigger award_guestlist_checkin_points_after_change after insert or update of status on public.event_guestlist_entries
for each row execute function public.award_guestlist_checkin_points();

create or replace function public.award_referral_points()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.award_user_points(new.affiliate_user_id,100,'referral','referral:' || new.referred_user_id::text,jsonb_build_object('referred_user_id',new.referred_user_id));
  return new;
end;
$$;

drop trigger if exists award_referral_points_after_insert on public.user_referrals;
create trigger award_referral_points_after_insert after insert on public.user_referrals
for each row execute function public.award_referral_points();

alter table public.user_points_accounts enable row level security;
alter table public.user_point_transactions enable row level security;
create policy "points accounts public read" on public.user_points_accounts for select to anon,authenticated using (true);
create policy "users read own point transactions" on public.user_point_transactions for select to authenticated using (user_id = (select auth.uid()));

do $$ declare order_record public.orders%rowtype; row_record record; begin
  for order_record in select * from public.orders where payment_status in ('free','paid') loop
    perform public.award_user_points(order_record.buyer_id,public.points_for_order(order_record),case when order_record.payment_status = 'free' then 'free_ticket' else 'paid_ticket' end,'order:' || order_record.id::text,jsonb_build_object('order_id',order_record.id,'event_id',order_record.event_id));
  end loop;
  for row_record in select c.id,c.event_id,t.id as ticket_id,t.owner_id from public.ticket_checkins c join public.tickets t on t.id = c.ticket_id loop
    perform public.award_user_points(row_record.owner_id,500,'event_checkin','checkin:' || row_record.id::text,jsonb_build_object('event_id',row_record.event_id,'ticket_id',row_record.ticket_id));
  end loop;
  for row_record in select * from public.user_referrals loop
    perform public.award_user_points(row_record.affiliate_user_id,100,'referral','referral:' || row_record.referred_user_id::text,jsonb_build_object('referred_user_id',row_record.referred_user_id));
  end loop;
end $$;
