"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";
import { freeCommunityTicket, mockTickets } from "@/lib/mock-tickets";
import type { AppTicket } from "@/types/app-ticket";
import { TicketQr } from "./TicketQr";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { openCalendarEvent } from "@/lib/calendar";

type TicketTab = "Upcoming" | "Guestlist" | "To Review" | "Reviewed" | "Cancelled";
const emptyTicketText: Record<TicketTab, string> = {
  Upcoming: "No upcoming tickets yet. Discover an event to get started.",
  Guestlist: "No guestlist passes.",
  "To Review": "No tickets to review.",
  Reviewed: "No reviewed tickets yet.",
  Cancelled: "No cancelled tickets.",
};
type GuestlistPass = AppTicket & { guestName: string; plusOnes: number; arrived: boolean; notes: string };
const tabLabels: readonly TicketTab[] = ["Upcoming", "Guestlist", "To Review", "Reviewed", "Cancelled"];

export function MyTicketsScreen({ initialTab = "Upcoming" }: { initialTab?: TicketTab }) {
  const router = useRouter();
  const { requireAuth } = useAuthGate();
  const [tab, setTab] = useState<TicketTab>(initialTab);
  const [qrTicket, setQrTicket] = useState<AppTicket | null>(null);
  const [supportTicket, setSupportTicket] = useState<AppTicket | null>(null);
  const [reviewTicket, setReviewTicket] = useState<AppTicket | null>(null);
  const [notice, setNotice] = useState("");
  const [hasFreeTicket, setHasFreeTicket] = useState(false);
  const [databaseTickets, setDatabaseTickets] = useState<AppTicket[] | null>(null);
  const [guestlistPasses, setGuestlistPasses] = useState<GuestlistPass[] | null>(null);
  const [signInRequired, setSignInRequired] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const allTickets = useMemo(() => hasSupabaseConfig ? (databaseTickets ?? []) : (hasFreeTicket ? [freeCommunityTicket, ...mockTickets] : [...mockTickets]), [databaseTickets, hasFreeTicket]);
  const tickets = useMemo(() => tab === "Guestlist" ? [] : allTickets.filter((ticket) => tab === "To Review" ? ticket.status === "Past" && !ticket.reviewed : tab === "Reviewed" ? ticket.status === "Past" && ticket.reviewed : ticket.status === tab), [allTickets, tab]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const purchased = JSON.parse(window.localStorage.getItem("attnd:purchased-events") ?? "[]") as string[];
        setHasFreeTicket(purchased.includes(freeCommunityTicket.eventId));
      } catch { setHasFreeTicket(false); }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    let active = true;
    const loadTickets = async () => {
      const { data: { user } } = await createClient().auth.getUser();
      if (!active) return;
      if (!user) { setSignInRequired(true); setDatabaseTickets([]); setGuestlistPasses([]); void requireAuth({ action: "Log in or create an account to see your tickets.", next: "/tickets" }); return; }
      const [ticketResult, reviewResult, guestResponse] = await Promise.all([
        createClient().from("tickets").select("id, order_id, qr_token, status, ticket_types(name), events(id, slug, title, cover_url, starts_at, ends_at, venue_name, city, status, host_id, profiles!events_host_id_fkey(first_name,username))").order("created_at", { ascending: false }),
        createClient().from("event_reviews").select("event_id").eq("user_id", user.id),
        fetch("/api/guestlist"),
      ]);
      if (!active) return;
      const { data, error } = ticketResult;
      const reviewedEventIds = new Set((reviewResult.data || []).map((review) => review.event_id));
      type TicketRow = { id: string; order_id: string; qr_token: string; status: string; ticket_types: { name: string } | null; events: { id: string; slug: string; title: string; cover_url: string | null; starts_at: string | null; ends_at: string | null; venue_name: string | null; city: string | null; status: string; host_id: string | null; profiles: { first_name: string | null; username: string | null } | null } | null };
      const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "Date to be announced";
      const formatTime = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "Time to be announced";
      setDatabaseTickets(error ? [] : (data as unknown as TicketRow[]).filter((row) => row.events).map((row) => {
        const event = row.events!;
        const cancelled = row.status === "cancelled" || row.status === "refunded" || event.status === "cancelled";
        const past = Boolean(event.ends_at && new Date(event.ends_at).getTime() < Date.now());
        return {
          id: row.id, eventId: event.slug, title: event.title,
          image: event.cover_url || "/events/gallery-friends.jpg", imageAlt: event.title,
          date: formatDate(event.starts_at), time: formatTime(event.starts_at),
          startsAt: event.starts_at || undefined, endsAt: event.ends_at || undefined,
          location: [event.venue_name, event.city].filter(Boolean).join(", ") || "Location to be announced",
          ticketType: row.ticket_types?.name || "Admission", status: cancelled ? "Cancelled" : past ? "Past" : "Upcoming",
          qrToken: row.qr_token, orderId: row.order_id, databaseEventId: event.id, hostId: event.host_id || undefined, hostName: event.profiles?.first_name || event.profiles?.username || "the host", reviewed: reviewedEventIds.has(event.id),
        } satisfies AppTicket;
      }));
      const guestResult = await guestResponse.json() as { passes?: Array<{ id: string; guest_name: string; plus_ones: number; notes: string; status: string; access_token: string; events: { slug: string; title: string; cover_url: string | null; starts_at: string | null; ends_at: string | null; venue_name: string | null; city: string | null; status: string } }> };
      setGuestlistPasses(guestResponse.ok ? (guestResult.passes || []).map((pass) => ({
        id: pass.id, eventId: pass.events.slug, title: pass.events.title, image: pass.events.cover_url || "/events/gallery-friends.jpg", imageAlt: pass.events.title,
        date: formatDate(pass.events.starts_at), time: formatTime(pass.events.starts_at), location: [pass.events.venue_name, pass.events.city].filter(Boolean).join(", ") || "Location to be announced",
        startsAt: pass.events.starts_at || undefined, endsAt: pass.events.ends_at || undefined,
        ticketType: "Guestlist Pass", status: pass.events.status === "cancelled" ? "Cancelled" : pass.events.ends_at && new Date(pass.events.ends_at).getTime() < Date.now() ? "Past" : "Upcoming",
        qrToken: pass.access_token, guestName: pass.guest_name, plusOnes: pass.plus_ones, arrived: pass.status === "arrived", notes: pass.notes,
      })) : []);
      setLoadError(Boolean(error && !guestResponse.ok));
    };
    void loadTickets();
    return () => { active = false; };
  }, [requireAuth]);

  const openNotifications = async () => {
    if (await requireAuth({ action: "Log in or create an account to see your notifications.", next: "/notifications" })) router.push("/notifications");
  };

  return <div className="my-tickets-screen">
    <header className="my-tickets-header"><h1>Tickets</h1><button type="button" onClick={() => void openNotifications()} aria-label="Notifications" className="page-notification-link"><DiscoverIcon name="bell" /></button></header>
    <div className="my-ticket-tabs" role="tablist" aria-label="Ticket status">{tabLabels.map((label) => { const count = label === "Guestlist" ? guestlistPasses?.length || 0 : label === "To Review" ? allTickets.filter((ticket) => ticket.status === "Past" && !ticket.reviewed).length : label === "Reviewed" ? allTickets.filter((ticket) => ticket.status === "Past" && ticket.reviewed).length : allTickets.filter((ticket) => ticket.status === label).length; return <button key={label} type="button" role="tab" aria-selected={tab === label} onClick={() => setTab(label)}>{label} ({count})</button>; })}</div>
    <section className="my-ticket-list" aria-live="polite">{hasSupabaseConfig && (databaseTickets === null || guestlistPasses === null) ? <p className="my-ticket-empty">Loading tickets…</p> : signInRequired ? <p className="my-ticket-empty">Sign in to see your tickets. <Link href="/onboarding">Sign in</Link></p> : loadError ? <p className="my-ticket-empty">Tickets could not be loaded. Please try again.</p> : tab === "Guestlist" ? guestlistPasses?.length ? guestlistPasses.map((pass) => <TicketCard key={pass.id} ticket={pass} guestlistPass={pass} onQr={() => setQrTicket(pass)} onReport={() => setSupportTicket(pass)} onReview={() => setReviewTicket(pass)} />) : <p className="my-ticket-empty">No guestlist passes.</p> : tickets.length ? tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} onQr={() => setQrTicket(ticket)} onReport={() => setSupportTicket(ticket)} onReview={() => setReviewTicket(ticket)} />) : <p className="my-ticket-empty">{emptyTicketText[tab]}</p>}</section>
    {notice && <button type="button" className="my-ticket-notice" onClick={() => setNotice("")}>{notice}</button>}
    {qrTicket && <div className="my-ticket-qr-overlay" role="dialog" aria-modal="true" aria-label={`${qrTicket.title} QR code`}><button type="button" aria-label="Close QR code" onClick={() => setQrTicket(null)}><DiscoverIcon name="x" /></button><TicketQr token={qrTicket.qrToken} /><strong>{qrTicket.title}</strong><span>Show this code at entry</span></div>}
    {supportTicket && <TicketSupportDialog key={supportTicket.id} ticket={supportTicket} onClose={() => setSupportTicket(null)} onDone={(message) => { setSupportTicket(null); setNotice(message); }} />}
    {reviewTicket && <TicketReviewDialog key={reviewTicket.id} ticket={reviewTicket} onClose={() => setReviewTicket(null)} onDone={() => { setDatabaseTickets((current) => current?.map((ticket) => ticket.eventId === reviewTicket.eventId ? { ...ticket, reviewed: true } : ticket) || current); setReviewTicket(null); setTab("Reviewed"); setNotice("Your event and host reviews are live."); }} />}
  </div>;
}

function TicketCard({ ticket, guestlistPass, onQr, onReport, onReview }: { ticket: AppTicket; guestlistPass?: GuestlistPass; onQr: () => void; onReport: () => void; onReview: () => void }) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const addToCalendar = () => {
    const fallbackStart = new Date(`${ticket.date} ${ticket.time}`);
    openCalendarEvent({ id: ticket.eventId, title: ticket.title, start: ticket.startsAt || (Number.isNaN(fallbackStart.getTime()) ? null : fallbackStart), end: ticket.endsAt, location: ticket.location });
  };
  return <article className={`my-ticket-card${ticket.status === "Past" && !ticket.reviewed ? " needs-review" : ""}`}>
    <div className="my-ticket-card-top">{(guestlistPass || ticket.status !== "Upcoming") && <span>{guestlistPass ? guestlistPass.arrived ? "Checked in" : "Guestlist" : ticket.status === "Past" ? ticket.reviewed ? "Reviewed" : "To Review" : ticket.status}</span>}<div className="my-ticket-options-wrap"><button type="button" aria-label={`More options for ${ticket.title}`} aria-expanded={optionsOpen} onClick={() => setOptionsOpen((open) => !open)}>•••</button>{optionsOpen && <div className="my-ticket-options" role="menu">{!guestlistPass && ticket.status === "Upcoming" && ticket.orderId ? <button type="button" role="menuitem" onClick={() => { setOptionsOpen(false); onReport(); }}>Report / Refund</button> : <span>No additional options</span>}</div>}</div></div>
    <div className="my-ticket-card-copy"><h2>{ticket.title}</h2><p><DiscoverIcon name="calendar" /><span>{ticket.date} · {ticket.time}</span></p><p><DiscoverIcon name="pin" />{ticket.location}</p>{guestlistPass ? <p><DiscoverIcon name="users" />{guestlistPass.guestName}{guestlistPass.plusOnes ? ` +${guestlistPass.plusOnes}` : ""}</p> : ticket.id !== "sunset-breathwork" && <p><DiscoverIcon name="ticket" />{ticket.ticketType}</p>}</div>
    <button type="button" className="my-ticket-qr" onClick={onQr} aria-label={`Show ${ticket.title} QR code`}><TicketQr token={ticket.qrToken} /><span>Show at Entry</span></button>
    {!guestlistPass && ticket.status === "Past" && <button type="button" className="my-ticket-review-callout" onClick={onReview}><span>★</span><p><strong>{ticket.reviewed ? "Edit your review" : "How was it?"}</strong><small>{ticket.reviewed ? "Update your event and host rating" : `Review the event and ${ticket.hostName || "the host"}`}</small></p><DiscoverIcon name="chevron" /></button>}
    <div className={`my-ticket-card-actions${!guestlistPass && ticket.status === "Upcoming" ? " has-three" : ""}`}><Link href={`/events/${ticket.eventId}`}><DiscoverIcon name="eye" />Details</Link><button type="button" onClick={addToCalendar}><DiscoverIcon name="calendar" />Add</button>{!guestlistPass && ticket.status === "Upcoming" && <Link href={`/tickets/transfer?ticket=${encodeURIComponent(ticket.id)}`}><DiscoverIcon name="send" />Transfer</Link>}</div>
  </article>;
}

function TicketReviewStars({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="ticket-review-stars" aria-label={`${value} out of 5 stars`}>{[1,2,3,4,5].map((star) => <button key={star} type="button" aria-label={`${star} stars`} aria-pressed={star <= value} onClick={() => onChange(star)}>★</button>)}</div>;
}

function TicketReviewDialog({ ticket, onClose, onDone }: { ticket: AppTicket; onClose: () => void; onDone: () => void }) {
  const [eventRating, setEventRating] = useState(5);
  const [eventBody, setEventBody] = useState("");
  const [hostRating, setHostRating] = useState(5);
  const [hostBody, setHostBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch(`/api/events/${encodeURIComponent(ticket.eventId)}/reviews`, { cache: "no-store" }).then((response) => response.json()).then((result: { ownReview?: { rating: number; body: string } | null; ownHostReview?: { rating: number; body: string } | null }) => {
      if (!active) return;
      if (result.ownReview) { setEventRating(result.ownReview.rating); setEventBody(result.ownReview.body); }
      if (result.ownHostReview) { setHostRating(result.ownHostReview.rating); setHostBody(result.ownHostReview.body); }
    });
    return () => { active = false; };
  }, [ticket.eventId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch(`/api/events/${encodeURIComponent(ticket.eventId)}/reviews`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rating: eventRating, body: eventBody, hostRating, hostBody }) });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) { setError(result.error || "Your review could not be saved."); return; }
    onDone();
  }
  return <div className="ticket-review-overlay" role="dialog" aria-modal="true" aria-labelledby="ticket-review-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form onSubmit={submit}>
    <header><div><small>VERIFIED REVIEW</small><h2 id="ticket-review-title">How was your experience?</h2><p>{ticket.title}</p></div><button type="button" aria-label="Close review" onClick={onClose}><DiscoverIcon name="x" /></button></header>
    <section><h3>Rate the event</h3><TicketReviewStars value={eventRating} onChange={setEventRating} /><textarea required minLength={5} maxLength={1500} value={eventBody} onChange={(event) => setEventBody(event.target.value)} placeholder="What did you like? What should other guests know?" /></section>
    <section><h3>Rate {ticket.hostName || "the host"}</h3><TicketReviewStars value={hostRating} onChange={setHostRating} /><textarea required minLength={5} maxLength={1500} value={hostBody} onChange={(event) => setHostBody(event.target.value)} placeholder="How was the organisation and communication?" /></section>
    {error && <p className="ticket-support-error" role="alert">{error}</p>}
    <button className="ticket-review-submit" type="submit" disabled={busy || eventBody.trim().length < 5 || hostBody.trim().length < 5}>{busy ? "Publishing…" : ticket.reviewed ? "Update reviews" : "Publish reviews"}</button>
    <p className="ticket-review-note"><DiscoverIcon name="check" />Shown as verified because this ticket belongs to you.</p>
  </form></div>;
}

function TicketSupportDialog({ ticket, onClose, onDone }: { ticket: AppTicket; onClose: () => void; onDone: (message: string) => void }) {
  const [kind, setKind] = useState<"refund" | "issue">("refund");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticket.orderId || reason.trim().length < 5) return setError("Please add a short explanation.");
    setBusy(true); setError("");
    const prefix = kind === "issue" ? "[Ticket issue] " : "[Refund request] ";
    const response = await fetch("/api/refunds/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: ticket.orderId, reason: `${prefix}${reason.trim()}` }) });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error || "Your request could not be sent.");
    onDone(kind === "refund" ? "Refund request sent to Attnd support." : "Ticket issue sent to Attnd support.");
  }
  return <div className="ticket-support-overlay" role="dialog" aria-modal="true" aria-labelledby="ticket-support-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form onSubmit={submit}><header><div><small>ATTND SUPPORT</small><h2 id="ticket-support-title">Report or refund</h2><p>{ticket.title}</p></div><button type="button" aria-label="Close" onClick={onClose}><DiscoverIcon name="x" /></button></header><div className="ticket-support-kinds" role="radiogroup" aria-label="Request type"><button type="button" role="radio" aria-checked={kind === "refund"} onClick={() => setKind("refund")}><DiscoverIcon name="ticket" /><span><strong>Request a refund</strong><small>Ask us to review your purchase</small></span></button><button type="button" role="radio" aria-checked={kind === "issue"} onClick={() => setKind("issue")}><DiscoverIcon name="info" /><span><strong>Report a ticket issue</strong><small>Tell us what is not working</small></span></button></div><label>What happened?<textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={1000} placeholder={kind === "refund" ? "Why are you requesting a refund?" : "Describe the problem with your ticket…"} required /></label>{error && <p role="alert" className="ticket-support-error">{error}</p>}<button type="submit" className="ticket-support-submit" disabled={busy || reason.trim().length < 5}>{busy ? "Sending…" : "Send request"}</button><p className="ticket-support-note">Attnd support will review your request and notify you about the result.</p></form></div>;
}
