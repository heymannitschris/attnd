create or replace function public.create_pending_order(
  p_buyer_id uuid,
  p_event_id uuid,
  p_ticket_type_id uuid,
  p_quantity integer,
  p_platform_fee_minor integer,
  p_protection_fee_minor integer,
  p_affiliate_user_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  selected public.ticket_types%rowtype;
  new_order uuid;
begin
  if p_quantity < 1 or p_quantity > 10 then raise exception 'Invalid quantity'; end if;
  if not exists (select 1 from public.profiles where id = p_buyer_id) then raise exception 'Buyer not found'; end if;
  if not exists (select 1 from public.events where id = p_event_id and status = 'published') then raise exception 'Event is not available'; end if;
  select * into selected from public.ticket_types where id = p_ticket_type_id and event_id = p_event_id and active and price_minor > 0 for update;
  if not found then raise exception 'Ticket type not found'; end if;
  if selected.sold_count + selected.reserved_count + p_quantity > selected.quantity then raise exception 'Not enough tickets remain'; end if;
  update public.ticket_types set reserved_count = reserved_count + p_quantity where id = selected.id;
  insert into public.orders (buyer_id, event_id, payment_status, currency, subtotal_minor, platform_fee_minor, total_minor, affiliate_user_id)
  values (p_buyer_id, p_event_id, 'pending', selected.currency, selected.price_minor * p_quantity, p_platform_fee_minor, selected.price_minor * p_quantity + p_platform_fee_minor + p_protection_fee_minor, p_affiliate_user_id)
  returning id into new_order;
  insert into public.order_items (order_id, ticket_type_id, quantity, unit_price_minor)
  values (new_order, selected.id, p_quantity, selected.price_minor);
  return new_order;
end;
$$;
revoke all on function public.create_pending_order(uuid, uuid, uuid, integer, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.create_pending_order(uuid, uuid, uuid, integer, integer, integer, uuid) to service_role;

create or replace function public.finalize_paid_order(p_order_id uuid, p_stripe_session_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare item record;
begin
  update public.orders
  set payment_status = 'paid', paid_at = now(), stripe_checkout_session_id = p_stripe_session_id
  where id = p_order_id and payment_status = 'pending';
  if not found then return; end if;

  for item in select * from public.order_items where order_id = p_order_id loop
    update public.ticket_types
    set sold_count = sold_count + item.quantity,
        reserved_count = greatest(0, reserved_count - item.quantity)
    where id = item.ticket_type_id and sold_count + item.quantity <= quantity;
    if not found then raise exception 'Ticket inventory exhausted'; end if;

    insert into public.tickets (order_id, event_id, ticket_type_id, owner_id)
    select o.id, o.event_id, item.ticket_type_id, o.buyer_id
    from public.orders o, generate_series(1, item.quantity)
    where o.id = p_order_id;
  end loop;
end;
$$;
revoke all on function public.finalize_paid_order(uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_paid_order(uuid, text) to service_role;

create or replace function public.release_pending_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare item record;
begin
  perform 1 from public.orders where id = p_order_id and payment_status = 'pending' for update;
  if not found then return; end if;
  for item in select * from public.order_items where order_id = p_order_id loop
    update public.ticket_types set reserved_count = greatest(0, reserved_count - item.quantity) where id = item.ticket_type_id;
  end loop;
  update public.orders set payment_status = 'failed' where id = p_order_id;
end;
$$;
revoke all on function public.release_pending_order(uuid) from public, anon, authenticated;
grant execute on function public.release_pending_order(uuid) to service_role;

create or replace function public.reserve_free_ticket(p_event_id uuid, p_ticket_type_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  selected public.ticket_types%rowtype;
  new_order uuid;
  new_ticket uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into selected from public.ticket_types
  where id = p_ticket_type_id and event_id = p_event_id and active and price_minor = 0
  for update;
  if not found then raise exception 'Free ticket type not found'; end if;
  if selected.sold_count + selected.reserved_count >= selected.quantity then raise exception 'Event is full'; end if;

  insert into public.orders (buyer_id, event_id, payment_status, currency)
  values (uid, p_event_id, 'free', selected.currency) returning id into new_order;
  insert into public.order_items (order_id, ticket_type_id, quantity, unit_price_minor)
  values (new_order, selected.id, 1, 0);
  update public.ticket_types set sold_count = sold_count + 1 where id = selected.id;
  insert into public.tickets (order_id, event_id, ticket_type_id, owner_id)
  values (new_order, p_event_id, selected.id, uid) returning id into new_ticket;
  return new_ticket;
end;
$$;
revoke all on function public.reserve_free_ticket(uuid, uuid) from public, anon;
grant execute on function public.reserve_free_ticket(uuid, uuid) to authenticated;

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
  if not exists (select 1 from public.events e where e.id = selected.event_id and e.host_id = uid) then raise exception 'Not allowed'; end if;
  if selected.status <> 'valid' then raise exception 'Ticket is not valid'; end if;

  update public.tickets set status = 'used' where id = selected.id;
  insert into public.ticket_checkins (ticket_id, event_id, checked_in_by)
  values (selected.id, selected.event_id, uid);
  return query select selected.id, coalesce(selected.attendee_name, 'Guest'), 'used'::text;
end;
$$;
revoke all on function public.check_in_ticket(uuid) from public, anon;
grant execute on function public.check_in_ticket(uuid) to authenticated;
