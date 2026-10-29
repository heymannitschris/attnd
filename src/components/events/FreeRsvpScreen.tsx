"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DiscoveryEvent } from "@/types/event";
import { DiscoverIcon } from "./DiscoverIcon";

export function FreeRsvpScreen({ event, databaseEventId, ticketTypeId }: { event: DiscoveryEvent; databaseEventId: string; ticketTypeId: string }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function reserveSpot() {
    setPending(true); setNotice("");
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: databaseEventId, ticketTypeId, quantity: 1 }) });
      const result = await response.json() as { error?: string; loginRequired?: boolean };
      if (result.loginRequired) { router.push(`/onboarding?next=${encodeURIComponent(window.location.pathname)}`); return; }
      if (!response.ok) throw new Error(result.error || "Could not reserve your spot");
      setConfirmed(true);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not reserve your spot"); }
    finally { setPending(false); }
  }

  return <div className="free-rsvp-screen">
    <header className="free-rsvp-header"><Link href={`/events/${event.id}`} aria-label="Back to event"><DiscoverIcon name="chevron" /></Link><h1>{confirmed ? "Spot Reserved" : "Join Event"}</h1><span /></header>
    <main>
      <div className="free-rsvp-image"><Image src={event.image} alt={event.imageAlt} fill priority sizes="(max-width: 672px) 100vw, 672px" className="object-cover" /></div>
      {confirmed ? <section className="free-rsvp-confirmed"><span><DiscoverIcon name="check" /></span><h2>You&apos;re going!</h2><p>Your free spot for {event.title} is reserved and now appears in My Tickets.</p><div><Link href={`/events/${event.id}`}>View Event</Link><Link href="/tickets">My Tickets</Link></div></section> : <section className="free-rsvp-summary"><span>FREE COMMUNITY EVENT</span><h2>{event.title}</h2><p><DiscoverIcon name="calendar" />{event.date} · {event.time}</p><p><DiscoverIcon name="pin" />{event.location}</p><div><DiscoverIcon name="ticket" /><p><strong>Free admission</strong><small>No payment details needed. Reserve once and your ticket is ready immediately.</small></p></div></section>}
    </main>
    {!confirmed && <footer><button type="button" disabled={pending} onClick={() => void reserveSpot()}>{pending ? "Reserving…" : "Reserve Free Spot"} <DiscoverIcon name="arrow" /></button>{notice && <p role="status">{notice}</p>}</footer>}
  </div>;
}
