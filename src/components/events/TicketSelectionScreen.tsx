"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DiscoveryEvent } from "@/types/event";
import type { TicketTier } from "@/types/ticket";
import { DiscoverIcon } from "./DiscoverIcon";
import { useSavedEvents } from "./SavedEventsProvider";
import { buildAffiliateEventUrl } from "@/lib/affiliate-links";


const formatPrice = (value: number) => `฿${new Intl.NumberFormat("en-US").format(value)}`;

type LocalBenefit = { benefit_type: "free" | "percentage"; discount_percent: number; locality: string };
type WaitlistEntry = { id: string; ticket_type_id: string; quantity: number; status: "waiting" | "offered"; offer_expires_at: string | null; position: number | null };

export function TicketSelectionScreen({ event, tiers, showGoing, databaseEventId }: { event: DiscoveryEvent; tiers: TicketTier[]; showGoing: boolean; databaseEventId: string }) {
  const router = useRouter();
  const { savedIds, toggleSaved } = useSavedEvents();
  const [selectedId, setSelectedId] = useState(() => tiers.find((tier) => tier.availability !== "sold-out")?.id || tiers[0]?.id || "");
  const [quantity, setQuantity] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(() => event.startsAt ? Math.max(0, Math.floor((new Date(event.startsAt).getTime() - Date.now()) / 1000)) : 0);
  const [showFeeInfo, setShowFeeInfo] = useState(false);
  const [notice, setNotice] = useState("");
  const [localBenefit, setLocalBenefit] = useState<LocalBenefit | null>(null);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [waitlistBusy, setWaitlistBusy] = useState("");
  const saved = savedIds.has(event.id);
  const selectedTier = tiers.find((tier) => tier.id === selectedId) ?? tiers[0];
  const selectedWaitlistOffer = waitlistEntries.find((entry) => entry.ticket_type_id === selectedTier?.id && entry.status === "offered");
  const canCheckout = Boolean(selectedTier && (selectedTier.availability !== "sold-out" || selectedWaitlistOffer));
  const effectivePrice = (price: number) => localBenefit?.benefit_type === "free" ? 0 : localBenefit?.benefit_type === "percentage" ? Math.round(price * (100 - localBenefit.discount_percent)) / 100 : price;
  const total = effectivePrice(selectedTier?.price ?? 0) * quantity;
  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  useEffect(() => {
    const timer = window.setInterval(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/local-access?eventId=${encodeURIComponent(databaseEventId)}`, { cache: "no-store" }).then(async (response) => response.ok ? response.json() : null).then((data) => { if (active && data?.eligible) setLocalBenefit(data.rule); });
    return () => { active = false; };
  }, [databaseEventId]);

  async function loadWaitlist() {
    const response = await fetch(`/api/waitlist?eventId=${encodeURIComponent(databaseEventId)}`, { cache: "no-store" });
    if (!response.ok) return;
    const result = await response.json() as { entries?: WaitlistEntry[] };
    setWaitlistEntries(result.entries || []);
  }

  useEffect(() => { void loadWaitlist(); }, [databaseEventId]);

  async function joinWaitlist(ticketTypeId: string) {
    setWaitlistBusy(ticketTypeId);
    const response = await fetch("/api/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: databaseEventId, ticketTypeId, quantity: 1 }) });
    const result = await response.json() as { error?: string; loginRequired?: boolean };
    if (result.loginRequired) { router.push(`/onboarding?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    setNotice(response.ok ? "You’re on the waitlist. We’ll notify you when a ticket opens." : result.error || "Could not join the waitlist");
    if (response.ok) await loadWaitlist();
    setWaitlistBusy("");
  }

  async function leaveWaitlist(entry: WaitlistEntry) {
    setWaitlistBusy(entry.ticket_type_id);
    const response = await fetch(`/api/waitlist?id=${encodeURIComponent(entry.id)}`, { method: "DELETE" });
    setNotice(response.ok ? "You left the waitlist." : "Could not update the waitlist");
    if (response.ok) await loadWaitlist();
    setWaitlistBusy("");
  }

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function shareEvent() {
    const url = buildAffiliateEventUrl(window.location.origin, event.id);
    try {
      if (navigator.share) await navigator.share({ title: event.title, text: `Join me at ${event.title}`, url });
      else { await navigator.clipboard.writeText(url); setNotice("Event link copied"); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setNotice("Sharing is unavailable right now");
    }
  }

  return <div className="ticket-selection-screen">
    <section className="ticket-selection-hero" aria-label={event.title}>
      <Image src={event.image} alt={event.imageAlt} fill priority sizes="(max-width: 672px) 100vw, 672px" className="object-cover" />
      <div className="ticket-hero-shade" />
      <div className="ticket-hero-controls"><button type="button" onClick={() => router.back()} aria-label="Go back" className="icon-button"><DiscoverIcon name="chevron" className="h-5 w-5 rotate-90" /></button><div><button type="button" aria-label={saved ? "Unsave event" : "Save event"} aria-pressed={saved} onClick={() => toggleSaved(event.id)} className="icon-button"><DiscoverIcon name="heart" filled={saved} /></button><button type="button" aria-label="Share event" onClick={() => void shareEvent()} className="icon-button"><DiscoverIcon name="share" /></button></div></div>
      {showGoing && <div className="ticket-going"><span className="ticket-going-check"><DiscoverIcon name="heart" filled /></span><strong>Event saved</strong><span>Choose a ticket to attend</span></div>}
      <div className="ticket-hero-details"><p>{event.date.replace("Saturday", "Sat").replace("Sunday", "Sun").replace("Friday", "Fri").toUpperCase()} · {event.time}</p><h1>{event.title}</h1><div className="ticket-hero-location"><DiscoverIcon name="pin" />{event.location}</div><div className="ticket-hero-attendees"><DiscoverIcon name="users" /><span>{event.attendeeCount} people are going</span></div><div className="ticket-hero-tags">{event.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>
    </section>

    <section className="ticket-selection-panel" aria-label="Select tickets">
      <div className="ticket-panel-handle" />
      <div className="ticket-panel-heading"><h2>Select Tickets</h2>{event.startsAt && secondsLeft > 0 && <div className="ticket-countdown"><span aria-hidden="true">◴</span><p>Event starts in<strong>{days}d {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</strong></p></div>}</div>
      {localBenefit && <div className="ticket-local-benefit"><span>✓</span><p><strong>Local Member benefit</strong><small>{localBenefit.benefit_type === "free" ? `Free entry for verified ${localBenefit.locality} locals` : `${localBenefit.discount_percent}% local discount applied automatically`}</small></p></div>}
      <div className="ticket-selection-scroll"><div role="radiogroup" aria-label="Ticket type" className="ticket-tier-list">{tiers.map((tier) => { const localPrice = effectivePrice(tier.price); return <button key={tier.id} type="button" role="radio" aria-checked={selectedId === tier.id} disabled={tier.availability === "sold-out"} onClick={() => { setSelectedId(tier.id); if (localPrice === 0) setQuantity(1); }} className="ticket-tier"><span className="ticket-tier-radio" /><span className="ticket-tier-copy"><span className="ticket-tier-name">{tier.name}{tier.badge && <span className="ticket-best-deal">{tier.badge}</span>}</span><small>{tier.description}</small></span><span className="ticket-tier-price"><strong>{localPrice !== tier.price && <del>{formatPrice(tier.price)}</del>}{formatPrice(localPrice)}</strong><small>{tier.availability === "sold-out" ? "Sold out" : localBenefit ? "Local price" : tier.availability === "available" ? "Available" : "Limited"}</small></span></button>; })}</div>
      {tiers.some((tier) => tier.availability === "sold-out") && <div className="ticket-waitlist-list">{tiers.filter((tier) => tier.availability === "sold-out").map((tier) => { const entry = waitlistEntries.find((item) => item.ticket_type_id === tier.id); return <article key={tier.id} className={entry?.status === "offered" ? "is-offered" : ""}><span><strong>{tier.name}</strong><small>{entry?.status === "offered" ? `Reserved for you until ${new Date(entry.offer_expires_at!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : entry ? `You’re number ${entry.position} on the waitlist` : "Get notified when a ticket becomes available"}</small></span>{entry?.status === "offered" ? <button type="button" onClick={() => router.push(`/events/${event.id}/checkout?tier=${tier.id}&quantity=${entry.quantity}`)}>Buy now</button> : entry ? <button type="button" disabled={waitlistBusy === tier.id} onClick={() => void leaveWaitlist(entry)}>Leave</button> : <button type="button" disabled={waitlistBusy === tier.id} onClick={() => void joinWaitlist(tier.id)}>{waitlistBusy === tier.id ? "Joining…" : "Join waitlist"}</button>}</article>; })}</div>}
      <div className="ticket-share-earn"><span className="ticket-share-icon"><DiscoverIcon name="users" /></span><p><strong>Earn 25% per sale</strong><small>Share this event with your friends and earn commission.</small></p><button type="button" onClick={() => void shareEvent()}><DiscoverIcon name="share" />Share & Earn</button></div></div>
      <div className="ticket-quantity"><strong>Quantity</strong><div className="ticket-stepper"><button type="button" aria-label="Decrease quantity" disabled={quantity <= 1 || effectivePrice(selectedTier?.price || 0) === 0} onClick={() => setQuantity((current) => Math.max(1, current - 1))}>−</button><output aria-label="Quantity">{quantity}</output><button type="button" aria-label="Increase quantity" disabled={quantity >= 10 || effectivePrice(selectedTier?.price || 0) === 0} onClick={() => setQuantity((current) => Math.min(10, current + 1))}>＋</button></div></div>
      <div className="ticket-total"><div><strong>Total</strong><strong>{formatPrice(total)}</strong></div><button type="button" onClick={() => setShowFeeInfo(!showFeeInfo)} aria-expanded={showFeeInfo}>+ Platform fee (10%) <DiscoverIcon name="info" /></button>{showFeeInfo && <p>A 10% platform fee is added at checkout.</p>}</div>
      <button type="button" className="ticket-continue" disabled={!canCheckout} onClick={() => router.push(`/events/${event.id}/checkout?tier=${selectedId}&quantity=${selectedWaitlistOffer?.quantity || quantity}`)}><span aria-hidden="true">▤</span>{canCheckout ? selectedWaitlistOffer ? "Buy Reserved Ticket" : "Get Tickets" : "Join a waitlist above"}<DiscoverIcon name="arrow" /></button>
    </section>
    {notice && <p role="status" className="details-toast">{notice}</p>}
  </div>;
}
