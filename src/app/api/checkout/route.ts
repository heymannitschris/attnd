import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createStripe, getAppUrl, getOrCreateStripeCustomer } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type CheckoutRequest = {
  eventId?: string;
  ticketTypeId?: string;
  quantity?: number;
  affiliateId?: string | null;
  attendees?: Array<{ firstName?: string; lastName?: string; email?: string }>;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as CheckoutRequest;
    const quantity = Math.max(1, Math.min(10, Number(body.quantity) || 1));
    if (!body.eventId || !body.ticketTypeId) return NextResponse.json({ error: "Missing ticket selection" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in before checkout", loginRequired: true }, { status: 401 });

    const { data: event } = await supabase.from("events").select("id, slug, title, cover_url, status, starts_at, ticket_sales_during_event").eq("id", body.eventId).eq("status", "published").single();
    const { data: tier } = await supabase.from("ticket_types").select("id, event_id, name, description, price_minor, currency, quantity, sold_count, reserved_count, active").eq("id", body.ticketTypeId).eq("event_id", body.eventId).single();
    if (!event || !tier || !tier.active) return NextResponse.json({ error: "Ticket is unavailable" }, { status: 404 });
    if (event.starts_at && new Date(event.starts_at).getTime() <= Date.now() && !event.ticket_sales_during_event) return NextResponse.json({ error: "Ticket sales closed when this event started" }, { status: 409 });
    const admin = createAdminClient();
    const { data: waitlistOffer } = await admin.from("event_waitlist").select("id,quantity,offer_expires_at").eq("event_id", event.id).eq("ticket_type_id", tier.id).eq("user_id", user.id).eq("status", "offered").gt("offer_expires_at", new Date().toISOString()).maybeSingle();
    const hasWaitlistOffer = Boolean(waitlistOffer && waitlistOffer.quantity === quantity);
    if (waitlistOffer && waitlistOffer.quantity !== quantity) return NextResponse.json({ error: `Your waitlist offer is reserved for ${waitlistOffer.quantity} ticket${waitlistOffer.quantity === 1 ? "" : "s"}` }, { status: 409 });
    if (!hasWaitlistOffer && tier.sold_count + tier.reserved_count + quantity > tier.quantity) return NextResponse.json({ error: "Not enough tickets remain" }, { status: 409 });
    const [{ data: localRule }, { data: localMembership }, { data: localRedemption }] = await Promise.all([
      admin.from("event_local_access_rules").select("enabled,locality,benefit_type,discount_percent,capacity,redeemed_count").eq("event_id", event.id).eq("enabled", true).maybeSingle(),
      admin.from("local_memberships").select("locality,status,expires_at").eq("user_id", user.id).eq("status", "verified").maybeSingle(),
      admin.from("local_access_redemptions").select("id").eq("event_id", event.id).eq("user_id", user.id).maybeSingle(),
    ]);
    const localEligible = Boolean(localRule && localMembership && !localRedemption && localMembership.locality.toLowerCase() === localRule.locality.toLowerCase() && (!localMembership.expires_at || new Date(localMembership.expires_at).getTime() > Date.now()) && (localRule.capacity == null || localRule.redeemed_count < localRule.capacity));

    if (tier.price_minor === 0 || (localEligible && localRule?.benefit_type === "free")) {
      if (quantity !== 1) return NextResponse.json({ error: "Choose one free ticket at a time" }, { status: 400 });
      const { data: ticketId, error } = hasWaitlistOffer
        ? await admin.rpc("reserve_free_ticket_from_waitlist", { p_waitlist_id: waitlistOffer!.id, p_user_id: user.id })
        : localEligible && localRule?.benefit_type === "free"
          ? await admin.rpc("reserve_local_free_ticket", { p_user_id: user.id, p_event_id: event.id, p_ticket_type_id: tier.id })
          : await supabase.rpc("reserve_free_ticket", { p_event_id: event.id, p_ticket_type_id: tier.id });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if (hasWaitlistOffer && localEligible && localRule?.benefit_type === "free") {
        const { data: orderTicket } = await admin.from("tickets").select("order_id").eq("id", ticketId).maybeSingle();
        if (orderTicket?.order_id) {
          await admin.from("local_access_redemptions").insert({ event_id: event.id, user_id: user.id, order_id: orderTicket.order_id, benefit_type: "free", discount_percent: 100 });
          await admin.from("event_local_access_rules").update({ redeemed_count: localRule.redeemed_count + 1, updated_at: new Date().toISOString() }).eq("event_id", event.id);
        }
      }
      const affiliateMomentId = (await cookies()).get("attnd_affiliate_moment")?.value;
      if (ticketId && affiliateMomentId && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(affiliateMomentId)) {
        const { data: ticket } = await admin.from("tickets").select("order_id").eq("id", ticketId).maybeSingle();
        if (ticket?.order_id) await admin.from("orders").update({ affiliate_moment_id: affiliateMomentId }).eq("id", ticket.order_id).eq("event_id", event.id);
      }
      return NextResponse.json({ free: true, ticketId, localBenefit: localEligible && localRule?.benefit_type === "free" });
    }

    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Paid tickets are temporarily unavailable" }, { status: 503 });
    }
    if (!Array.isArray(body.attendees) || body.attendees.length !== quantity) {
      return NextResponse.json({ error: "Enter details for every attendee" }, { status: 400 });
    }
    const attendees = body.attendees.map((person, index) => ({ position: index + 1, first_name: person.firstName?.trim() || "", last_name: person.lastName?.trim() || "", email: person.email?.trim().toLowerCase() || null }));
    if (attendees.some((person) => !person.first_name || !person.last_name || person.first_name.length > 80 || person.last_name.length > 80 || (person.email && (person.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email)))) || !attendees[0].email) {
      return NextResponse.json({ error: "Check attendee names and email addresses" }, { status: 400 });
    }

    const unitPrice = localEligible && localRule?.benefit_type === "percentage" ? Math.round(tier.price_minor * (100 - localRule.discount_percent) / 100) : tier.price_minor;
    const subtotal = unitPrice * quantity;
    const platformFee = Math.round(subtotal * 0.1);
    const directAffiliateId = body.affiliateId || (await cookies()).get("attnd_affiliate")?.value;
    const affiliateMomentId = (await cookies()).get("attnd_affiliate_moment")?.value;
    const { data: referral } = directAffiliateId ? { data: null } : await admin.from("user_referrals").select("affiliate_user_id").eq("referred_user_id", user.id).maybeSingle();
    const attributedId = directAffiliateId || referral?.affiliate_user_id;
    const affiliateId = attributedId && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(attributedId) && attributedId !== user.id ? attributedId : null;
    const { data: orderId, error: orderError } = hasWaitlistOffer
      ? await admin.rpc("create_pending_order_from_waitlist", { p_waitlist_id: waitlistOffer!.id, p_buyer_id: user.id, p_unit_price_minor: unitPrice, p_platform_fee_minor: platformFee, p_affiliate_user_id: affiliateId })
      : localEligible && localRule?.benefit_type === "percentage"
        ? await admin.rpc("create_discounted_pending_order", { p_buyer_id: user.id, p_event_id: event.id, p_ticket_type_id: tier.id, p_quantity: quantity, p_unit_price_minor: unitPrice, p_platform_fee_minor: platformFee, p_affiliate_user_id: affiliateId })
        : await admin.rpc("create_pending_order", { p_buyer_id: user.id, p_event_id: event.id, p_ticket_type_id: tier.id, p_quantity: quantity, p_platform_fee_minor: platformFee, p_protection_fee_minor: 0, p_affiliate_user_id: affiliateId });
    if (orderError || !orderId) return NextResponse.json({ error: orderError?.message || "Could not reserve tickets" }, { status: 400 });
    if (hasWaitlistOffer && localEligible && localRule?.benefit_type === "percentage") {
      await admin.from("local_access_redemptions").insert({ event_id: event.id, user_id: user.id, order_id: orderId, benefit_type: "percentage", discount_percent: localRule.discount_percent });
      await admin.from("event_local_access_rules").update({ redeemed_count: localRule.redeemed_count + 1, updated_at: new Date().toISOString() }).eq("event_id", event.id);
    }
    if (affiliateMomentId && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(affiliateMomentId)) await admin.from("orders").update({ affiliate_moment_id: affiliateMomentId }).eq("id", orderId).eq("event_id", event.id);
    const { error: attendeeError } = await admin.from("order_attendees").insert(attendees.map((person) => ({ ...person, order_id: orderId })));
    if (attendeeError) {
      await admin.rpc("release_pending_order", { p_order_id: orderId });
      return NextResponse.json({ error: "Could not save attendee details" }, { status: 500 });
    }

    const stripe = createStripe();
    const stripeCustomerId = await getOrCreateStripeCustomer(user);
    let checkoutSession;
    try {
      const appUrl = getAppUrl(request);
      const eventPath = `/events/${encodeURIComponent(event.slug || event.id)}`;
      const successUrl = `${appUrl}${eventPath}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${appUrl}${eventPath}/checkout/payment?tier=${encodeURIComponent(tier.id)}&quantity=${quantity}&checkout=cancelled`;
      const ticketDescription = tier.description?.trim().slice(0, 500) || `${quantity} ticket${quantity === 1 ? "" : "s"} for ${event.title}`;
      const images = event.cover_url && /^https:\/\//i.test(event.cover_url) ? [event.cover_url] : undefined;
      checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "hosted",
        customer: stripeCustomerId,
        client_reference_id: orderId,
        line_items: [
          {
            price_data: {
              currency: tier.currency,
              unit_amount: unitPrice,
              product_data: { name: `${event.title} — ${tier.name}`, description: ticketDescription, images },
            },
            quantity,
          },
          ...(platformFee > 0 ? [{
            price_data: {
              currency: tier.currency,
              unit_amount: platformFee,
              product_data: { name: "Attnd booking fee", description: "Secure booking, ticket delivery and customer support" },
            },
            quantity: 1,
          }] : []),
        ],
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        customer_update: { name: "auto", address: "auto" },
        expires_at: Math.floor(Date.now() / 1000) + (31 * 60),
        success_url: successUrl,
        cancel_url: cancelUrl,
        submit_type: "book",
        custom_text: { submit: { message: "Your Attnd ticket is confirmed after payment. You’ll return to Attnd automatically." } },
        payment_intent_data: {
          setup_future_usage: "off_session",
          metadata: { order_id: orderId, event_id: event.id, buyer_id: user.id },
        },
        metadata: { order_id: orderId, event_id: event.id, buyer_id: user.id },
      }, { idempotencyKey: `attnd-order-${orderId}` });
    } catch (error) {
      await admin.rpc("release_pending_order", { p_order_id: orderId });
      throw error;
    }
    if (!checkoutSession.url) {
      await admin.rpc("release_pending_order", { p_order_id: orderId });
      return NextResponse.json({ error: "Payment could not be initialized" }, { status: 500 });
    }
    const { error: paymentReferenceError } = await admin.from("orders").update({ stripe_checkout_session_id: checkoutSession.id, stripe_payment_intent_id: null }).eq("id", orderId);
    if (paymentReferenceError) {
      await stripe.checkout.sessions.expire(checkoutSession.id).catch(() => undefined);
      await admin.rpc("release_pending_order", { p_order_id: orderId });
      return NextResponse.json({ error: "Payment could not be linked to your order" }, { status: 500 });
    }
    return NextResponse.json({ checkoutUrl: checkoutSession.url, sessionId: checkoutSession.id, localDiscountPercent: localEligible && localRule?.benefit_type === "percentage" ? localRule.discount_percent : 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout failed" }, { status: 500 });
  }
}
