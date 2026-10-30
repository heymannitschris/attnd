"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { DiscoveryEvent, EventDetails } from "@/types/event";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { DiscoverIcon } from "./DiscoverIcon";
import { EventPhotoGallery } from "./EventPhotoGallery";
import { EventAttendeesSheet } from "./EventAttendeesSheet";
import { EventLocationMap } from "./EventLocationMap";
import { useSavedEvents } from "./SavedEventsProvider";
import { buildAffiliateEventUrl } from "@/lib/affiliate-links";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import { LiveMomentsSection } from "./LiveMomentsSection";
import { EventReviewsPanel } from "./EventReviewsPanel";
import { SafetyActions } from "@/components/safety/SafetyActions";
import { useFollowing } from "@/components/profile/FollowingProvider";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { openCalendarEvent } from "@/lib/calendar";

type DetailTab = "About" | "Schedule" | "Location" | "Reviews";
const tabs: readonly DetailTab[] = ["About", "Schedule", "Location", "Reviews"];

export function EventDetailsScreen({ event, details, databaseEventId, embedded = false, onClose }: { event: DiscoveryEvent; details: EventDetails; databaseEventId: string; embedded?: boolean; onClose?: () => void }) {
  const router = useRouter();
  const { savedIds, toggleSaved } = useSavedEvents();
  const { isFollowing, toggleFollowing } = useFollowing();
  const { requireAuth } = useAuthGate();
  const saved = savedIds.has(event.id);
  const followed = isFollowing(details.host.id);
  const [shareOpen, setShareOpen] = useState(false);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [coverIndex, setCoverIndex] = useState(0);
  const coverRailRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("About");
  const [notice, setNotice] = useState("");
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [descriptionOverflows, setDescriptionOverflows] = useState(false);
  const headingDescriptionRef = useRef<HTMLParagraphElement>(null);
  const [hasTicket, setHasTicket] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const price = event.price.replace("From ", "");
  const galleryMedia = details.media?.length ? details.media : details.photos.map((photo) => ({ src: photo.src, alt: photo.alt, kind: "photo" as const, category: photo.category, description: photo.caption }));
  const isFree = details.admission === "rsvp";
  // The sales state is intentionally evaluated when the live detail view renders.
  // eslint-disable-next-line react-hooks/purity
  const salesOpen = !event.startsAt || new Date(event.startsAt).getTime() > Date.now() || Boolean(event.ticketSalesDuringEvent);

  useEffect(() => {
    if (hasSupabaseConfig) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      try {
        const purchased = JSON.parse(window.localStorage.getItem("attnd:purchased-events") ?? "[]") as string[];
        setHasTicket(purchased.includes(event.id));
      } catch {
        setHasTicket(false);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [event.id]);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    let active = true;
    void (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (active) setCurrentUserId(user.id);
      window.localStorage.setItem("attnd:user-id", user.id);
      if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(databaseEventId)) return;
      const { count } = await supabase.from("tickets").select("id", { count: "exact", head: true }).eq("event_id", databaseEventId).eq("owner_id", user.id).in("status", ["valid", "used"]);
      if (active) setHasTicket(Boolean(count));
    })();
    return () => { active = false; };
  }, [databaseEventId]);

  useEffect(() => {
    let measureFrame = 0;
    const resetFrame = window.requestAnimationFrame(() => {
      setExpandedDescription(false);
      measureFrame = window.requestAnimationFrame(() => {
        const description = headingDescriptionRef.current;
        setDescriptionOverflows(Boolean(description && description.scrollHeight > description.clientHeight + 1));
      });
    });
    return () => { window.cancelAnimationFrame(resetFrame); window.cancelAnimationFrame(measureFrame); };
  }, [event.id, details.description]);

  const isEventCreator = Boolean(currentUserId && currentUserId === details.host.id);

  function notify(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 2200); }
  function openGallery(index = 0) { setPhotoIndex(index); setGalleryOpen(true); }
  async function getTicket() {
    const next = isFree ? `/events/${event.id}/rsvp` : `/events/${event.id}/tickets`;
    if (await requireAuth({ action: "Log in or create an account to get a ticket.", next })) router.push(next);
  }
  async function saveEvent() {
    if (!await toggleSaved(event.id)) return;
    notify(saved ? "Removed from saved events" : "Saved for later");
  }
  async function inviteFriends() {
    const next = `/events/${event.id}/invite`;
    if (await requireAuth({ action: "Log in or create an account to invite friends.", next })) router.push(next);
  }
  function getDirections() {
    const location = details.location;
    if (!location) return;
    const destination = `${location.lat},${location.lon}`;
    const isAppleDevice = /iPhone|iPad|iPod|Macintosh/i.test(window.navigator.userAgent);
    const url = isAppleDevice
      ? `https://maps.apple.com/?daddr=${destination}&q=${encodeURIComponent(event.title)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}&destination_place_id=${encodeURIComponent(event.title)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function addToCalendar() {
    openCalendarEvent({ id: event.id, title: event.title, start: event.startsAt, end: event.endsAt, location: details.location?.address || event.location });
  }

  async function share() {
    const url = buildAffiliateEventUrl(window.location.origin, event.id);
    if (navigator.share) {
      try { await navigator.share({ title: event.title, text: `${event.title} · ${event.date}`, url }); return; }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); notify("Event link copied"); }
    catch { setShareOpen(true); }
  }

  return <div className="event-detail-v2">
    <section className="event-detail-v2-hero">
      <div ref={coverRailRef} className="event-detail-v2-cover-rail" onScroll={(scrollEvent) => { const width = scrollEvent.currentTarget.clientWidth; if (width) setCoverIndex(Math.round(scrollEvent.currentTarget.scrollLeft / width)); }}>
        {galleryMedia.map((item, index) => <div className="event-detail-v2-cover-slide" key={item.src}>{item.kind === "video" ? <video src={item.src} controls autoPlay={index === 0} muted loop playsInline preload={index === 0 ? "auto" : "metadata"} aria-label={item.alt} className="event-detail-v2-cover" /> : <button type="button" onClick={() => openGallery(index)} aria-label={`Open photo ${index + 1} of ${galleryMedia.length}`}><Image src={item.src} alt={item.alt} fill priority={index === 0} sizes="(max-width: 672px) 100vw, 672px" className="event-detail-v2-cover" /></button>}</div>)}
      </div>
      <span className="event-detail-v2-shade" />
      <div className="event-detail-v2-topbar">{embedded ? <button type="button" aria-label="Back to events" className="icon-button" onClick={onClose}><DiscoverIcon name="chevron" className="h-5 w-5 rotate-90" /></button> : <button type="button" aria-label="Back to previous page" className="icon-button" onClick={() => { if (window.history.length > 1) router.back(); else router.push("/discover"); }}><DiscoverIcon name="chevron" className="h-5 w-5 rotate-90" /></button>}</div>
      {galleryMedia.length > 1 && <div className="event-detail-v2-gallery-dots" aria-label={`Media ${coverIndex + 1} of ${galleryMedia.length}`}>{galleryMedia.map((item, index) => <i key={item.src} data-active={index === coverIndex} />)}</div>}
      <div className="event-detail-v2-heading"><h1>{event.title}</h1><div className="event-detail-v2-heading-description" data-expanded={expandedDescription}><p ref={headingDescriptionRef}>{details.description}</p>{descriptionOverflows && <button type="button" aria-label={expandedDescription ? "Collapse short description" : "Expand short description"} aria-expanded={expandedDescription} onClick={() => setExpandedDescription((current) => !current)}><DiscoverIcon name="chevron" /></button>}</div></div>
    </section>

    <main className="event-detail-v2-main">
      <section className="event-detail-v2-overview" aria-label="Event information">
        <div className="event-detail-v2-keyfacts">
          <div className="event-detail-v2-fact"><DiscoverIcon name="calendar" /><p><strong>{event.date.replace("Sunday", "Sun").replace("Saturday", "Sat").replace("Friday", "Fri")}</strong><span>{event.time} – {details.endTime}</span></p></div>
          <div className="event-detail-v2-fact"><DiscoverIcon name="pin" /><p><strong>{event.location}</strong>{event.distance && <span>{event.distance}</span>}</p></div>
        </div>
        {isEventCreator && <Link href={`/create?id=${databaseEventId}`} className="event-detail-v2-edit-event"><DiscoverIcon name="edit" /><span><strong>Edit Event</strong><small>Update details, tickets, gallery and schedule</small></span><DiscoverIcon name="chevron" /></Link>}
        {hasTicket ? <Link href="/tickets" className="event-detail-v2-ticket-status is-going"><span><DiscoverIcon name="check" /></span><p><strong>You&apos;re going</strong><small>You have a ticket for this event</small></p><DiscoverIcon name="chevron" /></Link> : saved ? <Link href="/profile/saved" className="event-detail-v2-ticket-status is-saved"><span><DiscoverIcon name="heart" filled /></span><p><strong>Event saved</strong><small>You liked this event. Find it in your saved events.</small></p><DiscoverIcon name="chevron" /></Link> : null}
        <button type="button" onClick={() => setAttendeesOpen(true)} className="event-detail-v2-social"><AvatarStack people={details.attendees} size={31} /><strong>{event.attendeeCount} people are going</strong><DiscoverIcon name="chevron" /></button>
        <article className="event-detail-v2-host-card"><Link href={`/people/${details.host.id}`} className="event-detail-v2-host-link"><span className="event-detail-v2-host-avatar">{details.host.avatarUrl && <Image src={details.host.avatarUrl} alt="" fill sizes="54px" unoptimized={details.host.avatarUrl.startsWith("http")} />}</span><p><span>Hosted by</span><strong>{details.host.name} {details.host.verified && <b>✓</b>}</strong><small>{details.host.eventCount} {details.host.eventCount === 1 ? "event" : "events"}{details.host.rating !== "New" && <> · {details.host.rating} <em>★</em></>}</small></p><DiscoverIcon name="chevron" /></Link><button type="button" aria-pressed={followed} onClick={() => void toggleFollowing(details.host.id)}>{followed && <DiscoverIcon name="check" />}{followed ? "Following" : "Follow"}</button></article>
        {details.location && <article className="event-detail-v2-location-preview"><div><DiscoverIcon name="pin" /><p><strong>{event.location}</strong><span>{details.location.address}</span></p><button type="button" onClick={getDirections}>Get Directions</button></div></article>}
      </section>

      <section className="event-detail-v2-actions has-invite" aria-label="Event actions"><button type="button" disabled={!hasTicket && !salesOpen} onClick={() => hasTicket ? router.push("/tickets") : void getTicket()}><DiscoverIcon name={hasTicket ? "check" : "ticket"} />{hasTicket ? "View Ticket" : !salesOpen ? "Sales Closed" : isFree ? "Join Free" : "Get Ticket"}</button><button type="button" onClick={addToCalendar}><DiscoverIcon name="calendar" />Add to Calendar</button><button type="button" onClick={() => void inviteFriends()}><DiscoverIcon name="invite" />Invite Friends</button><button type="button" aria-pressed={saved} onClick={() => void saveEvent()}><DiscoverIcon name={saved ? "check" : "heart"} />{saved ? "Saved" : "Save"}</button><button type="button" onClick={share}><DiscoverIcon name="share" />Share</button></section>
      <LiveMomentsSection eventId={databaseEventId} eventSlug={event.id} eventTitle={event.title} startsAt={event.startsAt} endsAt={event.endsAt} enabled={event.liveDiscoveryEnabled} />
      <nav className="event-detail-v2-tabs" aria-label="Event detail sections">{tabs.map((tab) => <button type="button" key={tab} aria-current={activeTab === tab ? "page" : undefined} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>

      {activeTab === "About" && <section className="event-detail-v2-panel"><h2>About This Event</h2><p>{details.description}</p><div className="event-detail-report"><SafetyActions targetType="event" targetId={databaseEventId} label="Report event" /></div>{Boolean(details.expectations?.length) && <div className="event-detail-v2-expect"><h2>What to Expect</h2>{details.expectations?.map((item) => <p key={item}><DiscoverIcon name="check" />{item}</p>)}</div>}{galleryMedia.length > 0 && <div className="event-detail-v2-gallery-preview"><header><h2>Event Gallery</h2><button type="button" onClick={() => openGallery(0)}>All Media <DiscoverIcon name="arrow" /></button></header><div>{galleryMedia.slice(0, 3).map((item, index) => <button type="button" key={item.src} onClick={() => openGallery(index)} aria-label={`Open ${item.alt}`}>{item.kind === "video" ? <><video src={item.src} muted playsInline preload="metadata" /><span className="event-detail-v2-gallery-play" aria-hidden="true">▶</span></> : <Image src={item.src} alt={item.alt} fill sizes="30vw" />}</button>)}</div></div>}</section>}
      {activeTab === "Schedule" && <section className="event-detail-v2-panel"><h2>Schedule</h2>{details.schedule?.length ? <div className="event-detail-v2-list">{details.schedule.map((item) => <p key={`${item.time}-${item.title}`}><strong>{item.time}</strong><span>{item.title}</span></p>)}</div> : <p>The host has not published a schedule yet.</p>}</section>}
      {activeTab === "Location" && <section className="event-detail-v2-panel"><h2>Location</h2>{details.location ? <><div className="event-detail-v2-location"><EventLocationMap eventId={event.id} title={event.title} location={details.location} /></div><address className="event-detail-v2-address"><DiscoverIcon name="pin" /><p><strong>{event.location}</strong><span>{details.location.address}</span></p></address><button type="button" className="event-detail-v2-maps-button" onClick={getDirections}><DiscoverIcon name="pin" />Get Directions</button></> : <p>The exact location has not been published yet.</p>}</section>}
      {activeTab === "Reviews" && <section className="event-detail-v2-panel"><h2>Guest Reviews</h2><EventReviewsPanel eventId={event.id} /></section>}
    </main>

    <footer className={`event-detail-v2-ticketbar ${hasTicket ? "has-ticket" : ""}`}><button type="button" disabled={!hasTicket && !salesOpen} onClick={() => hasTicket ? router.push("/tickets") : void getTicket()}>{hasTicket ? "You’re going · View Ticket" : !salesOpen ? "Event in progress" : isFree ? "Join Free" : `Get Ticket · ${price}`} {salesOpen && <DiscoverIcon name="arrow" />}</button></footer>
    <BottomSheet open={shareOpen} onClose={() => setShareOpen(false)} title="Share event"><p className="text-sm text-muted">Copy this affiliate event link:</p><input aria-label="Affiliate event link" readOnly value={typeof window === "undefined" ? "" : buildAffiliateEventUrl(window.location.origin, event.id)} onFocus={(e) => e.target.select()} className="mt-3 block w-full rounded-xl border border-white/15 bg-black/20 px-3 py-3 text-sm text-foreground" /></BottomSheet>
    <EventAttendeesSheet open={attendeesOpen} onClose={() => setAttendeesOpen(false)} onInvite={() => void inviteFriends()} total={event.attendeeCount} attendees={details.attendees} />
    <EventPhotoGallery eventTitle={event.title} photos={details.photos} video={details.video} uploadedMedia={details.media} index={photoIndex} onIndexChange={setPhotoIndex} open={galleryOpen} onClose={() => setGalleryOpen(false)} />
    {notice && <p role="status" className="details-toast">{notice}</p>}
  </div>;
}
