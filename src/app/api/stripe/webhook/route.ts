import { createAdminClient } from "@/lib/supabase/admin";
import { createStripe } from "@/lib/stripe";
import { notifyUsers } from "@/lib/notify";
import { promoteWaitlistsForOrder } from "@/lib/waitlist";

async function finalizeOrder(orderId: string, paymentReference: string, amount: number, currency: string, paymentIntentId?: string) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("finalize_paid_order_with_amount", {
    p_order_id: orderId,
    p_stripe_session_id: paymentReference,
    p_paid_amount_minor: amount,
    p_paid_currency: currency,
  });
  if (error) throw error;
  if (paymentIntentId) {
    const { error: intentError } = await admin.from("orders").update({ stripe_payment_intent_id: paymentIntentId }).eq("id", orderId);
    if (intentError) throw intentError;
  }
  const { data: order } = await admin.from("orders").select("event_id,affiliate_user_id,subtotal_minor,currency,events(title,slug,host_id),affiliate_commissions(amount_minor)").eq("id", orderId).single();
  const eventRecord = order?.events as unknown as { title?: string; slug?: string; host_id?: string } | null;
  if (eventRecord?.host_id) await notifyUsers([eventRecord.host_id], { category: "Tickets", preference: "sales", title: "New ticket sale", body: `${eventRecord.title || "Your event"} received a new order.`, href: "/dashboard", metadata: { order_id: orderId } });
  const commission = (order?.affiliate_commissions as unknown as Array<{ amount_minor: number }> | null)?.[0];
  if (order?.affiliate_user_id && commission) await notifyUsers([order.affiliate_user_id], { category: "Affiliates", title: "You earned a new commission", body: `${(commission.amount_minor / 100).toFixed(2)} ${String(order.currency).toUpperCase()} from ${eventRecord?.title || "an event"}.`, href: "/affiliate", metadata: { order_id: orderId } });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook is not configured", { status: 503 });
  const stripe = createStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") || "", secret);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Invalid signature", { status: 400 });
  }

  if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") && event.data.object.payment_status === "paid") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id || session.client_reference_id;
    if (orderId) {
      if (session.amount_total === null || !session.currency) return new Response("Checkout amount is missing", { status: 500 });
      try {
        await finalizeOrder(orderId, session.id, session.amount_total, session.currency, typeof session.payment_intent === "string" ? session.payment_intent : undefined);
      } catch (error) {
        return new Response(error instanceof Error ? error.message : "Could not finalize order", { status: 500 });
      }
    }
  }
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const orderId = paymentIntent.metadata.order_id;
    if (orderId) {
      try {
        const admin = createAdminClient();
        const { data: order } = await admin.from("orders").select("stripe_checkout_session_id").eq("id", orderId).maybeSingle();
        // Hosted Checkout is fulfilled by checkout.session.completed so its
        // session ID stays the canonical payment reference. Keep this branch
        // only for PaymentIntents created by the previous direct-card flow.
        if (!order?.stripe_checkout_session_id?.startsWith("cs_")) {
          await finalizeOrder(orderId, paymentIntent.id, paymentIntent.amount_received || paymentIntent.amount, paymentIntent.currency, paymentIntent.id);
        }
      } catch (error) {
        return new Response(error instanceof Error ? error.message : "Could not finalize order", { status: 500 });
      }
    }
  }
  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    if (charge.refunded && typeof charge.payment_intent === "string") {
      const admin = createAdminClient();
      const { data: order } = await admin.from("orders").select("id").eq("stripe_payment_intent_id", charge.payment_intent).maybeSingle();
      if (order?.id) {
        const { error } = await admin.rpc("reverse_paid_order", { p_order_id: order.id });
        if (error) return new Response(error.message, { status: 500 });
        await promoteWaitlistsForOrder(order.id);
      }
    }
  }
  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id || session.client_reference_id;
    if (orderId) await createAdminClient().rpc("release_pending_order", { p_order_id: orderId });
  }
  if (event.type === "payment_intent.canceled") {
    const orderId = event.data.object.metadata.order_id;
    if (orderId) await createAdminClient().rpc("release_pending_order", { p_order_id: orderId });
  }
  return Response.json({ received: true });
}
