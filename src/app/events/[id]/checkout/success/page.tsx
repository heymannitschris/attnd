import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutSuccessScreen } from "@/components/events/CheckoutSuccessScreen";
import { getEventBundle } from "@/lib/events-data";
import { createStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendOrderConfirmation } from "@/lib/order-confirmation-mail";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tier?: string; quantity?: string; session_id?: string; payment_intent?: string; ticket_id?: string }>;
};

export const metadata: Metadata = { title: "Payment Successful | Attnd" };

export default async function CheckoutSuccessPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const bundle = await getEventBundle(id);
  if (!bundle || bundle.details.admission !== "tickets") notFound();
  let orderId: string | undefined;
  let ticketToken: string | undefined;
  let attendeeName: string | undefined;
  let paidTierId = query.tier;
  let paidQuantity = Number(query.quantity);
  let paidTotal: number | undefined = query.ticket_id ? 0 : undefined;
  if (query.ticket_id) {
    const { data: freeTicket } = await (await createClient()).from("tickets").select("qr_token, ticket_type_id, order_id").eq("id", query.ticket_id).maybeSingle();
    ticketToken = freeTicket?.qr_token;
    paidTierId = freeTicket?.ticket_type_id || paidTierId;
    orderId = freeTicket?.order_id || orderId;
  }
  if (query.session_id && process.env.STRIPE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const session = await createStripe().checkout.sessions.retrieve(query.session_id);
    if (session.payment_status !== "paid" || session.metadata?.event_id !== bundle.databaseId || session.amount_total === null || !session.currency) notFound();
    orderId = session.metadata?.order_id || session.client_reference_id || undefined;
    if (orderId) {
      paidTotal = session.amount_total / 100;
      const admin = createAdminClient();
      const { error } = await admin.rpc("finalize_paid_order_with_amount", {
        p_order_id: orderId,
        p_stripe_session_id: session.id,
        p_paid_amount_minor: session.amount_total,
        p_paid_currency: session.currency,
      });
      if (error) notFound();
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (paymentIntentId) await admin.from("orders").update({ stripe_payment_intent_id: paymentIntentId }).eq("id", orderId);
      // Fallback for the webhook; the atomic confirmation_email_sent_at claim prevents double sends.
      await sendOrderConfirmation(orderId);
      const { data: item } = await admin.from("order_items").select("ticket_type_id, quantity").eq("order_id", orderId).limit(1).maybeSingle();
      const { data: ticket } = await admin.from("tickets").select("qr_token").eq("order_id", orderId).limit(1).maybeSingle();
      paidTierId = item?.ticket_type_id || paidTierId;
      paidQuantity = item?.quantity || paidQuantity;
      ticketToken = ticket?.qr_token;
    }
  }
  if (query.payment_intent && process.env.STRIPE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const paymentIntent = await createStripe().paymentIntents.retrieve(query.payment_intent);
    if (!paymentIntent.metadata.order_id || paymentIntent.status !== "succeeded") notFound();
    orderId = paymentIntent.metadata.order_id;
    paidTotal = (paymentIntent.amount_received || paymentIntent.amount) / 100;
    const admin = createAdminClient();
    const { error } = await admin.rpc("finalize_paid_order_with_amount", {
      p_order_id: orderId,
      p_stripe_session_id: paymentIntent.id,
      p_paid_amount_minor: paymentIntent.amount_received || paymentIntent.amount,
      p_paid_currency: paymentIntent.currency,
    });
    if (error) notFound();
    await admin.from("orders").update({ stripe_payment_intent_id: paymentIntent.id }).eq("id", orderId);
    await sendOrderConfirmation(orderId);
    const { data: item } = await admin.from("order_items").select("ticket_type_id, quantity").eq("order_id", orderId).limit(1).maybeSingle();
    const { data: ticket } = await admin.from("tickets").select("qr_token").eq("order_id", orderId).limit(1).maybeSingle();
    paidTierId = item?.ticket_type_id || paidTierId;
    paidQuantity = item?.quantity || paidQuantity;
    ticketToken = ticket?.qr_token;
  }
  const tier = bundle.tiers.find((item) => item.id === paidTierId && item.availability !== "sold-out") ?? bundle.tiers[0];
  if (!tier) notFound();
  if (orderId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data: attendee } = await createAdminClient().from("order_attendees").select("first_name,last_name").eq("order_id", orderId).order("position").limit(1).maybeSingle();
    attendeeName = [attendee?.first_name, attendee?.last_name].filter(Boolean).join(" ") || undefined;
  }
  const parsedQuantity = paidQuantity;
  const quantity = Number.isInteger(parsedQuantity) ? Math.min(10, Math.max(1, parsedQuantity)) : 2;
  return <CheckoutSuccessScreen event={bundle.event} tier={tier} quantity={quantity} ticketToken={ticketToken} orderId={orderId} paidTotal={paidTotal} attendeeName={attendeeName} />;
}
