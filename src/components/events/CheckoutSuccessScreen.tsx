"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DiscoveryEvent } from "@/types/event";
import type { TicketTier } from "@/types/ticket";
import { TicketQr } from "@/components/tickets/TicketQr";
import { DiscoverIcon } from "./DiscoverIcon";
import { buildAffiliateEventUrl } from "@/lib/affiliate-links";
import { openCalendarEvent } from "@/lib/calendar";

const formatPrice = (value: number) => `฿${new Intl.NumberFormat("en-US").format(value)}`;

export function CheckoutSuccessScreen({ event, tier, quantity, ticketToken, orderId, paidTotal, attendeeName = "Attendee" }: { event: DiscoveryEvent; tier: TicketTier; quantity: number; ticketToken?: string; orderId?: string; paidTotal?: number; attendeeName?: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    const storageKey = "attnd:purchased-events";
    try {
      const current = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as string[];
      window.localStorage.setItem(storageKey, JSON.stringify(Array.from(new Set([...current, event.id]))));
    } catch {
      window.localStorage.setItem(storageKey, JSON.stringify([event.id]));
    }
  }, [event.id]);

  async function shareEvent() {
    const url = buildAffiliateEventUrl(window.location.origin, event.id);
    try {
      if (navigator.share) await navigator.share({ title: event.title, text: `Join me at ${event.title}`, url });
      else { await navigator.clipboard.writeText(url); setNotice("Event link copied"); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setNotice("Sharing is unavailable right now");
    }
  }

  function addToCalendar() {
    openCalendarEvent({ id: event.id, title: event.title, start: event.startsAt, end: event.endsAt, location: event.location });
  }

  function viewTickets() {
    if (/iPhone|iPad|iPod/i.test(window.navigator.userAgent)) {
      window.location.href = `com.ninjaworld.attndr://open?target=${encodeURIComponent("https://www.attnd.space/tickets")}`;
      window.setTimeout(() => router.push("/tickets"), 900);
      return;
    }
    router.push("/tickets");
  }

  return <div className="checkout-success-screen">
    <Link href="/tickets" aria-label="Close confirmation" className="success-close"><DiscoverIcon name="x" /></Link>
    <header className="success-heading">
      <div className="success-confetti" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
      <span className="success-check"><DiscoverIcon name="check" /></span>
      <h1>Payment Successful!</h1>
      <p>Your tickets are ready. See you there! 🎉</p>
      <div className="success-quick-actions"><button type="button" onClick={addToCalendar}><DiscoverIcon name="calendar" />Add to Calendar</button><button type="button" onClick={() => void shareEvent()}><DiscoverIcon name="send" />Share Event</button></div>
    </header>

    <section className="success-ticket" aria-label="Event ticket">
      <div className="success-ticket-hero" style={{ backgroundImage: `url(${event.image})` }}>
        <Image src={event.image} alt={event.imageAlt} fill priority sizes="(max-width: 672px) 100vw, 620px" className="success-ticket-photo object-cover" />
        <div className="success-ticket-shade" />
        <div><strong>{event.date.replace("Saturday", "Sat").toUpperCase()} · {event.time}</strong><h2>{event.title}</h2><p><DiscoverIcon name="pin" />{event.location}</p><small>{event.tags.join(" · ")}</small></div>
      </div>
      <div className="success-ticket-body">
        <div className="success-ticket-column"><TicketDatum label="Ticket Type" value={tier.name} detail="General admission" /><TicketDatum label="Attendee" value={attendeeName} /><TicketDatum label="Order ID" value={orderId ? `#${orderId.slice(0, 8).toUpperCase()}` : "Processing"} /></div>
        <button type="button" className="success-qr" onClick={() => setQrOpen(true)} aria-label="Enlarge ticket QR code"><TicketQr token={ticketToken} /><small>Tap to enlarge</small></button>
        <div className="success-ticket-column success-ticket-column-right"><TicketDatum label="Date" value={event.date.replace("Saturday", "Sat")} detail={event.time} /><TicketDatum label="Quantity" value={`${quantity} Tickets`} /><TicketDatum label="Total Paid" value={formatPrice(paidTotal ?? tier.price * quantity)} /></div>
      </div>
    </section>

    <section className="success-going"><span><DiscoverIcon name="leaf" /></span><p><strong>You&apos;re going!</strong><small>Your ticket is saved in Attnd. Invite friends to join you.</small></p></section>

    <section className="success-actions" aria-label="Ticket actions">
      <button type="button" onClick={() => void shareEvent()}><span>↗</span><p><strong>Share &amp; Earn 25%</strong><small>Invite friends and earn commission for each sale.</small></p><DiscoverIcon name="chevron" /></button>
      <button type="button" onClick={() => router.push("/tickets/transfer")}><span>⇄</span><p><strong>Transfer Tickets</strong><small>Send tickets to friends or someone else.</small></p><DiscoverIcon name="chevron" /></button>
      <Link href="/refunds"><span>◉</span><p><strong>Need to Cancel?</strong><small>View the refund policy and how to request help.</small></p><DiscoverIcon name="chevron" /></Link>
    </section>

    <button type="button" onClick={viewTickets} className="success-view-tickets">Open Attnd · View My Tickets <DiscoverIcon name="arrow" /></button>
    {notice && <p className="success-notice" role="status">{notice}</p>}

    {qrOpen && <div className="success-qr-overlay" role="dialog" aria-modal="true" aria-label="Ticket QR code"><button type="button" onClick={() => setQrOpen(false)} aria-label="Close QR code"><DiscoverIcon name="x" /></button><div><TicketQr token={ticketToken} /><p>{event.title}{orderId ? ` · #${orderId.slice(0, 8).toUpperCase()}` : ""}</p></div></div>}
  </div>;
}

function TicketDatum({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div><small>{label}</small><strong>{value}</strong>{detail && <span>{detail}</span>}</div>;
}
