create table if not exists public.order_attendees (
  order_id uuid not null references public.orders(id) on delete cascade,
  position integer not null check (position between 1 and 10),
  first_name text not null,
  last_name text not null,
  email text,
  primary key (order_id, position)
);
alter table public.order_attendees enable row level security;

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
    insert into public.tickets(order_id,event_id,ticket_type_id,owner_id,attendee_name,attendee_email)
    select paid_order.id, paid_order.event_id, item.ticket_type_id, paid_order.buyer_id,
      nullif(trim(concat_ws(' ', attendee.first_name, attendee.last_name)), ''), attendee.email
    from generate_series(1,item.quantity) as seat(position)
    left join public.order_attendees attendee on attendee.order_id = paid_order.id and attendee.position = seat.position;
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
