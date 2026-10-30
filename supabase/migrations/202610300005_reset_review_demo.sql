-- NOT APPLIED. Resets the App Review demo account's purchases for the hidden
-- review event so the reviewer can buy again. Hard-scoped to one buyer + one
-- event; refuses to touch anything else. Test-mode orders only (cs_test_).
create or replace function public.reset_review_demo_purchases()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  demo_buyer constant uuid := 'b6c2b9b8-cdd4-4694-895e-4dd9e214377d';
  demo_event constant uuid := 'd7dfc119-5eb3-452e-aae0-0cf07c919bb9';
  removed_orders int; removed_tickets int;
begin
  if exists (select 1 from public.orders o where o.event_id = demo_event and o.buyer_id <> demo_buyer) then
    raise exception 'Event has orders from other buyers; refusing reset';
  end if;
  if exists (select 1 from public.orders o where o.event_id = demo_event and o.stripe_checkout_session_id not like 'cs_test_%') then
    raise exception 'Live-mode order found; refusing reset';
  end if;
  -- ticket_checkins has no ON DELETE CASCADE
  delete from public.ticket_checkins c using public.tickets t
    where c.ticket_id = t.id and t.event_id = demo_event and t.owner_id = demo_buyer;
  select count(*) into removed_tickets from public.tickets where event_id = demo_event and owner_id = demo_buyer;
  -- cascades: tickets, order_items, order_attendees, ticket_transfers, revenue_allocations,
  -- affiliate_commissions, refund_requests, admin_payment_cases
  delete from public.orders where event_id = demo_event and buyer_id = demo_buyer;
  get diagnostics removed_orders = row_count;
  -- recompute counters from remaining truth (no other buyers => 0)
  update public.ticket_types tt set
    sold_count = (select count(*) from public.tickets t where t.ticket_type_id = tt.id and t.status in ('valid','used')),
    reserved_count = 0
  where tt.event_id = demo_event;
  return jsonb_build_object('orders', removed_orders, 'tickets', removed_tickets);
end;
$$;
revoke all on function public.reset_review_demo_purchases() from public, anon, authenticated;
