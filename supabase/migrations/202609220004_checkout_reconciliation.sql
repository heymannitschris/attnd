-- Reconcile a Stripe promotion-code discount before creating the ticket and
-- revenue ledger. The whole operation, including finalize_paid_order, is one
-- database transaction so concurrent webhook deliveries remain idempotent.
create or replace function public.finalize_paid_order_with_amount(
  p_order_id uuid,
  p_stripe_session_id text,
  p_paid_amount_minor integer,
  p_paid_currency text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  pending_order public.orders%rowtype;
  paid_ticket_subtotal integer;
begin
  select * into pending_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if pending_order.payment_status = 'paid' and pending_order.stripe_checkout_session_id = p_stripe_session_id then return; end if;
  if pending_order.payment_status <> 'pending' then raise exception 'Order cannot be finalized'; end if;
  if pending_order.stripe_checkout_session_id is distinct from p_stripe_session_id then raise exception 'Checkout session mismatch'; end if;
  if lower(coalesce(p_paid_currency, '')) <> lower(pending_order.currency) then raise exception 'Checkout currency mismatch'; end if;
  if p_paid_amount_minor is null or p_paid_amount_minor < 0 or p_paid_amount_minor > pending_order.total_minor or pending_order.total_minor <= 0 then
    raise exception 'Checkout amount mismatch';
  end if;

  -- Stripe discounts can affect both ticket and platform-fee line items.
  -- Allocate the actual paid amount in the original ticket/fee ratio.
  paid_ticket_subtotal := round(p_paid_amount_minor::numeric * pending_order.subtotal_minor / pending_order.total_minor);
  update public.orders set
    subtotal_minor = paid_ticket_subtotal,
    platform_fee_minor = p_paid_amount_minor - paid_ticket_subtotal,
    total_minor = p_paid_amount_minor
  where id = p_order_id;

  perform public.finalize_paid_order(p_order_id, p_stripe_session_id);
end; $$;
revoke all on function public.finalize_paid_order_with_amount(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.finalize_paid_order_with_amount(uuid, text, integer, text) to service_role;
