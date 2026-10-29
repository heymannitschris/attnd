create table if not exists public.event_waitlist (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 10),
  status text not null default 'waiting' check (status in ('waiting','offered','converted','expired','left')),
  offered_at timestamptz,
  offer_expires_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists event_waitlist_active_user_idx on public.event_waitlist(ticket_type_id,user_id) where status in ('waiting','offered');
create index if not exists event_waitlist_queue_idx on public.event_waitlist(ticket_type_id,status,created_at);
alter table public.orders add column if not exists waitlist_id uuid references public.event_waitlist(id) on delete set null;
alter table public.event_waitlist enable row level security;
create policy "users read own waitlist entries" on public.event_waitlist for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.join_event_waitlist(p_event_id uuid, p_ticket_type_id uuid, p_quantity integer default 1)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); selected public.ticket_types%rowtype; entry_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_quantity < 1 or p_quantity > 10 then raise exception 'Invalid quantity'; end if;
  select * into selected from public.ticket_types where id=p_ticket_type_id and event_id=p_event_id and active for update;
  if not found then raise exception 'Ticket type not found'; end if;
  if selected.sold_count + selected.reserved_count + p_quantity <= selected.quantity then raise exception 'Tickets are currently available'; end if;
  select id into entry_id from public.event_waitlist where ticket_type_id=p_ticket_type_id and user_id=uid and status in ('waiting','offered') limit 1;
  if entry_id is not null then return entry_id; end if;
  insert into public.event_waitlist(event_id,ticket_type_id,user_id,quantity) values(p_event_id,p_ticket_type_id,uid,p_quantity) returning id into entry_id;
  return entry_id;
end; $$;
revoke all on function public.join_event_waitlist(uuid,uuid,integer) from public,anon;
grant execute on function public.join_event_waitlist(uuid,uuid,integer) to authenticated;

create or replace function public.promote_event_waitlist(p_ticket_type_id uuid)
returns table(waitlist_id uuid,user_id uuid,event_id uuid,ticket_type_id uuid) language plpgsql security definer set search_path = '' as $$
declare selected public.ticket_types%rowtype; entry public.event_waitlist%rowtype;
begin
  select * into selected from public.ticket_types where id=p_ticket_type_id and active for update;
  if not found then return; end if;
  loop
    select * into entry from public.event_waitlist w where w.ticket_type_id=p_ticket_type_id and w.status='waiting' and w.quantity <= selected.quantity-selected.sold_count-selected.reserved_count order by w.created_at for update skip locked limit 1;
    exit when not found;
    update public.event_waitlist set status='offered',offered_at=now(),offer_expires_at=now()+interval '30 minutes',updated_at=now() where id=entry.id;
    update public.ticket_types set reserved_count=reserved_count+entry.quantity where id=p_ticket_type_id returning * into selected;
    waitlist_id:=entry.id; user_id:=entry.user_id; event_id:=entry.event_id; ticket_type_id:=entry.ticket_type_id; return next;
  end loop;
end; $$;
revoke all on function public.promote_event_waitlist(uuid) from public,anon,authenticated;
grant execute on function public.promote_event_waitlist(uuid) to service_role;

create or replace function public.leave_event_waitlist(p_waitlist_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); entry public.event_waitlist%rowtype;
begin
  select * into entry from public.event_waitlist where id=p_waitlist_id and user_id=uid and status in ('waiting','offered') for update;
  if not found then return null; end if;
  if entry.status='offered' then update public.ticket_types set reserved_count=greatest(0,reserved_count-entry.quantity) where id=entry.ticket_type_id; end if;
  update public.event_waitlist set status='left',updated_at=now() where id=entry.id;
  return entry.ticket_type_id;
end; $$;
revoke all on function public.leave_event_waitlist(uuid) from public,anon;
grant execute on function public.leave_event_waitlist(uuid) to authenticated;

create or replace function public.create_pending_order_from_waitlist(p_waitlist_id uuid,p_buyer_id uuid,p_unit_price_minor integer,p_platform_fee_minor integer,p_affiliate_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare entry public.event_waitlist%rowtype; selected public.ticket_types%rowtype; new_order uuid;
begin
  select * into entry from public.event_waitlist where id=p_waitlist_id and user_id=p_buyer_id and status='offered' and offer_expires_at>now() for update;
  if not found then raise exception 'Waitlist offer is no longer available'; end if;
  select * into selected from public.ticket_types where id=entry.ticket_type_id and event_id=entry.event_id and active for update;
  if not found or p_unit_price_minor < 0 or p_unit_price_minor > selected.price_minor then raise exception 'Invalid ticket price'; end if;
  insert into public.orders(buyer_id,event_id,payment_status,currency,subtotal_minor,platform_fee_minor,total_minor,affiliate_user_id,waitlist_id)
  values(p_buyer_id,entry.event_id,'pending',selected.currency,p_unit_price_minor*entry.quantity,p_platform_fee_minor,p_unit_price_minor*entry.quantity+p_platform_fee_minor,p_affiliate_user_id,entry.id) returning id into new_order;
  insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_minor) values(new_order,selected.id,entry.quantity,p_unit_price_minor);
  update public.event_waitlist set status='converted',converted_at=now(),updated_at=now() where id=entry.id;
  return new_order;
end; $$;
revoke all on function public.create_pending_order_from_waitlist(uuid,uuid,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.create_pending_order_from_waitlist(uuid,uuid,integer,integer,uuid) to service_role;

create or replace function public.reserve_free_ticket_from_waitlist(p_waitlist_id uuid,p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare entry public.event_waitlist%rowtype; selected public.ticket_types%rowtype; new_order uuid; new_ticket uuid;
begin
  select * into entry from public.event_waitlist where id=p_waitlist_id and user_id=p_user_id and status='offered' and offer_expires_at>now() and quantity=1 for update;
  if not found then raise exception 'Waitlist offer is no longer available'; end if;
  select * into selected from public.ticket_types where id=entry.ticket_type_id and event_id=entry.event_id and active for update;
  if not found then raise exception 'Ticket type not found'; end if;
  insert into public.orders(buyer_id,event_id,payment_status,currency,waitlist_id) values(p_user_id,entry.event_id,'free',selected.currency,entry.id) returning id into new_order;
  insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_minor) values(new_order,selected.id,1,0);
  update public.ticket_types set sold_count=sold_count+1,reserved_count=greatest(0,reserved_count-1) where id=selected.id;
  insert into public.tickets(order_id,event_id,ticket_type_id,owner_id) values(new_order,entry.event_id,selected.id,p_user_id) returning id into new_ticket;
  update public.event_waitlist set status='converted',converted_at=now(),updated_at=now() where id=entry.id;
  return new_ticket;
end; $$;
revoke all on function public.reserve_free_ticket_from_waitlist(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_free_ticket_from_waitlist(uuid,uuid) to service_role;

create or replace function public.expire_event_waitlist_offers()
returns setof uuid language plpgsql security definer set search_path = '' as $$
declare entry public.event_waitlist%rowtype;
begin
  for entry in select * from public.event_waitlist where status='offered' and offer_expires_at<=now() for update skip locked loop
    update public.ticket_types set reserved_count=greatest(0,reserved_count-entry.quantity) where id=entry.ticket_type_id;
    update public.event_waitlist set status='expired',updated_at=now() where id=entry.id;
    return next entry.ticket_type_id;
  end loop;
end; $$;
revoke all on function public.expire_event_waitlist_offers() from public,anon,authenticated;
grant execute on function public.expire_event_waitlist_offers() to service_role;
