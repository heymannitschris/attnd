"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DiscoveryEvent } from "@/types/event";
import type { TicketTier } from "@/types/ticket";
import { DiscoverIcon } from "./DiscoverIcon";

const formatPrice = (value: number) => `฿${new Intl.NumberFormat("en-US").format(value)}`;

function openHostedCheckout(url: string) {
  const nativeHandler = (window as Window & {
    webkit?: { messageHandlers?: { attndCheckout?: { postMessage: (value: { url: string }) => void } } };
  }).webkit?.messageHandlers?.attndCheckout;
  if (nativeHandler) {
    nativeHandler.postMessage({ url });
    return;
  }
  window.location.assign(url);
}

export function CheckoutPaymentScreen({ event, databaseEventId, tier, quantity, cancelled = false }: { event: DiscoveryEvent; databaseEventId: string; tier: TicketTier; quantity: number; cancelled?: boolean }) {
  const router = useRouter();
  const [discountOpen, setDiscountOpen] = useState(false);
  const [notice, setNotice] = useState(cancelled ? "Payment was cancelled. Your card was not charged." : "");
  const [paying, setPaying] = useState(false);
  const [localBenefit, setLocalBenefit] = useState<{ benefit_type: "free" | "percentage"; discount_percent: number } | null>(null);
  const [localAccessChecked, setLocalAccessChecked] = useState(false);

  useEffect(() => {
    void fetch(`/api/local-access?eventId=${encodeURIComponent(databaseEventId)}`)
      .then(async (response) => response.ok ? response.json() : null)
      .then((result: { eligible?: boolean; rule?: { benefit_type: "free" | "percentage"; discount_percent: number } } | null) => {
        if (result?.eligible && result.rule) setLocalBenefit(result.rule);
      })
      .catch(() => {})
      .finally(() => setLocalAccessChecked(true));
  }, [databaseEventId]);

  const localUnitPrice = localBenefit?.benefit_type === "free" ? 0 : localBenefit?.benefit_type === "percentage" ? Math.round(tier.price * (100 - localBenefit.discount_percent) / 100) : tier.price;
  const subtotal = localUnitPrice * quantity;
  const platformFee = Math.round(subtotal * 0.1);
  const total = subtotal + platformFee;
  const detailsUrl = `/events/${event.id}/checkout?tier=${tier.id}&quantity=${quantity}`;

  async function startPayment() {
    if (paying) return;
    setPaying(true);
    setNotice("");
    try {
      const affiliateId = new URLSearchParams(window.location.search).get("affiliate_id");
      const storedAttendees = window.sessionStorage.getItem(`attnd:checkout-attendees:${event.id}:${tier.id}`);
      const attendees = storedAttendees ? JSON.parse(storedAttendees) as Array<{ firstName: string; lastName: string; email: string }> : [];
      if (tier.price > 0 && attendees.length !== quantity) throw new Error("Please return to attendee details before paying.");
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: databaseEventId, ticketTypeId: tier.id, quantity, affiliateId, attendees }),
      });
      const result = await response.json() as { free?: boolean; ticketId?: string; checkoutUrl?: string | null; error?: string; loginRequired?: boolean };
      if (result.loginRequired) {
        router.push(`/onboarding?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      if (response.ok && result.free) {
        const ticketQuery = result.ticketId ? `&ticket_id=${encodeURIComponent(result.ticketId)}` : "";
        router.push(`/events/${event.id}/checkout/success?free=1&tier=${encodeURIComponent(tier.id)}&quantity=${quantity}${ticketQuery}`);
        return;
      }
      if (!response.ok || !result.checkoutUrl) throw new Error(result.error || "Checkout could not be started");
      openHostedCheckout(result.checkoutUrl);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Checkout could not be started");
      setPaying(false);
    }
  }

  return <div className="checkout-screen payment-screen">
    <div className="checkout-fixed-header">
      <header className="checkout-header">
        <Link href={detailsUrl} aria-label="Back to attendee details" className="icon-button checkout-back"><DiscoverIcon name="chevron" className="h-5 w-5 rotate-90" /></Link>
        <h1>Checkout</h1>
      </header>

      <nav className="checkout-steps" aria-label="Checkout progress">
        <div className="checkout-step is-complete"><span className="checkout-step-number"><DiscoverIcon name="check" /></span><span>Tickets</span></div>
        <div className="checkout-step-line is-complete" />
        <div className="checkout-step is-complete"><span className="checkout-step-number"><DiscoverIcon name="check" /></span><span>Details</span></div>
        <div className="checkout-step-line is-complete" />
        <div className="checkout-step is-current" aria-current="step"><span className="checkout-step-number">3</span><span>Payment</span></div>
      </nav>
    </div>

    <div className="checkout-scroll-content">
      <section className="checkout-event" aria-label="Selected event">
        <div className="checkout-event-image"><Image src={event.image} alt={event.imageAlt} fill priority sizes="(max-width: 672px) 110px, 160px" className="object-cover" /></div>
        <div className="checkout-event-info">
          <p className="checkout-event-date">{event.date.replace("Saturday", "Sat").replace("Sunday", "Sun").replace("Friday", "Fri").toUpperCase()} · {event.time}</p>
          <h2>{event.title}</h2>
          <p className="checkout-event-location"><DiscoverIcon name="pin" />{event.location}</p>
          <p className="checkout-event-people"><DiscoverIcon name="users" /><span>{event.attendeeCount} people are going</span></p>
          <div className="checkout-event-tags">{event.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </div>
      </section>

      <section className="payment-order" aria-labelledby="order-summary-heading">
        <div className="payment-section-heading"><h2 id="order-summary-heading">Order Summary</h2><Link href={`/events/${event.id}/tickets`} className="payment-edit">Edit</Link></div>
        <div className="payment-order-card">
          <div className="payment-order-row"><span><strong>Tickets</strong><small>{quantity} × {tier.name}</small>{localBenefit && <small>Verified local benefit · {localBenefit.benefit_type === "free" ? "free entry" : `${localBenefit.discount_percent}% off`}</small>}</span><span><strong>{formatPrice(localUnitPrice)}</strong><small>{formatPrice(subtotal)}</small></span></div>
          <div className="payment-fee-row"><span>Platform Fee (10%) <button type="button" aria-label="Platform fee information" onClick={() => setNotice("The platform fee supports secure booking and customer service.")}><DiscoverIcon name="info" /></button></span><strong>{formatPrice(platformFee)}</strong></div>
          <div className="payment-total"><strong>Total</strong><span>THB <strong>{formatPrice(total)}</strong></span></div>
        </div>
      </section>

      <section className={`payment-discount ${discountOpen ? "is-open" : ""}`}>
        <button type="button" className="payment-discount-toggle" aria-expanded={discountOpen} onClick={() => setDiscountOpen(!discountOpen)}><span className="payment-gift" aria-hidden="true"><DiscoverIcon name="gift" /></span><span>Have a discount code?</span><DiscoverIcon name="chevron" /></button>
        {discountOpen && <p className="payment-discount-copy">Enter your promotion code on the secure Stripe checkout page.</p>}
      </section>

      <section className="payment-web-checkout" aria-labelledby="payment-method-heading">
        <div className="payment-embedded-heading"><span><DiscoverIcon name="lock" /></span><div><h2 id="payment-method-heading">Secure web checkout</h2><p>Powered by Stripe</p></div></div>
        <p>Your email and order are carried over. Apple Pay, Link and cards appear automatically when available.</p>
        <div className="payment-web-methods" aria-label="Supported payment methods"><span>Apple Pay</span><span>Link</span><span>Cards</span></div>
        <small>Payment opens securely in your browser. After payment, you return to Attnd automatically.</small>
      </section>
    </div>

    <div className="checkout-fixed-action payment-fixed-action">
      <button type="button" disabled={!localAccessChecked || paying} onClick={() => void startPayment()} className="payment-pay"><DiscoverIcon name="lock" />{!localAccessChecked ? "Checking member benefits…" : paying ? "Opening secure checkout…" : localUnitPrice === 0 ? "Get Local Entry" : `Pay securely · ${formatPrice(total)}`}<DiscoverIcon name="arrow" /></button>
      {notice && <p role="status" className="payment-notice">{notice}</p>}
      <p className="payment-terms">By completing your purchase you agree to our <Link href="/terms">Terms of Service</Link> and <Link href="/refunds">Refund Policy</Link>.</p>
    </div>
  </div>;
}
