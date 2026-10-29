"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { mockExploreEvents } from "@/lib/mock-explore";
import type { ExploreEvent } from "@/types/explore";
import { DiscoverIcon } from "./DiscoverIcon";
import { EventCard } from "./EventCard";
import { EventDetailsScreen } from "./EventDetailsScreen";
import { OpenStreetEventMap } from "./OpenStreetEventMap";
import { useSavedEvents } from "./SavedEventsProvider";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import type { DiscoveryEvent, EventDetails } from "@/types/event";

type InterestFilter = "nearby" | "live" | "women" | "men" | "free";
type Interest = { id: string; title: string; categories: readonly string[]; emoji: string; color: string; filter?: InterestFilter };
type ExploreBundle = { event: DiscoveryEvent; details: EventDetails; databaseId: string };

const interests: readonly Interest[] = [
  { id: "nearby", title: "Nearby", categories: [], emoji: "📍", color: "#000000", filter: "nearby" },
  { id: "live", title: "Live", categories: [], emoji: "🔥", color: "#4a1f25", filter: "live" },
  { id: "women", title: "Women Only", categories: [], emoji: "👩", color: "#442243", filter: "women" },
  { id: "men", title: "Men Only", categories: [], emoji: "👨", color: "#1e3350", filter: "men" },
  { id: "free", title: "Free", categories: [], emoji: "🆓", color: "#523815", filter: "free" },
  { id: "music", title: "Music lovers", categories: ["Music", "Festival"], emoji: "🎵", color: "#3e205a" },
  { id: "nightlife", title: "Nightlife", categories: ["Nightlife", "Party", "Music"], emoji: "🪩", color: "#4b202a" },
  { id: "wellness", title: "Wellness", categories: ["Wellness", "Yoga", "Fitness"], emoji: "🧘", color: "#000000" },
  { id: "nature", title: "Nature lovers", categories: ["Nature", "Travel", "Retreat"], emoji: "🌿", color: "#29401d" },
  { id: "community", title: "Community", categories: ["Community", "Meetup", "Networking"], emoji: "🫶", color: "#183958" },
  { id: "creative", title: "Creative people", categories: ["Art", "Culture", "Workshop"], emoji: "🎨", color: "#492d18" },
  { id: "food", title: "Food & culture", categories: ["Food", "Culture"], emoji: "🍜", color: "#3e263d" },
] as const;

const matchesInterest = (event: ExploreEvent, interest: Interest) => {
  if (interest.filter === "free") return event.free;
  if (interest.filter === "women") return event.audience === "women";
  if (interest.filter === "men") return event.audience === "men";
  if (interest.filter === "nearby") return Number.parseFloat(event.distance) <= 10;
  if (interest.filter === "live") {
    if (!event.liveDiscoveryEnabled || !event.startsAt) return false;
    const now = Date.now();
    return new Date(event.startsAt).getTime() <= now && (!event.endsAt || new Date(event.endsAt).getTime() >= now);
  }
  return interest.categories.includes(event.category);
};

const toDiscoveryEvent = (event: ExploreEvent) => ({
  id: event.eventId,
  title: event.title,
  date: event.dateLabel,
  time: event.time,
  location: event.venue,
  distance: event.distance,
  price: event.price,
  attendeeCount: event.attendeeCount,
  tags: [event.category],
  image: event.image,
  imageAlt: event.imageAlt,
  badge: event.category,
  audience: event.audience,
});

export function ExploreExperience({ initialEvents = mockExploreEvents, initialBundles = [] }: { initialEvents?: readonly ExploreEvent[]; initialBundles?: readonly ExploreBundle[] }) {
  const router = useRouter();
  const [view, setView] = useState<"categories" | "map">("categories");
  const [mapFilter, setMapFilter] = useState<"all" | "live" | "free">("all");
  const [selectedMapEventId, setSelectedMapEventId] = useState<string | null>(null);
  const [activeInterest, setActiveInterest] = useState<Interest | null>(null);
  const [eventIndex, setEventIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailPull, setDetailPull] = useState(0);
  const pointerStart = useRef<number | null>(null);
  const detailScroller = useRef<HTMLDivElement>(null);
  const detailPullDistance = useRef(0);
  const decisionLocked = useRef(false);
  const { savedIds, toggleSaved } = useSavedEvents();
  const { requireAuth } = useAuthGate();
  const interestCards = useMemo(() => interests.map((interest, order) => {
    const events = initialEvents.filter((event) => matchesInterest(event, interest));
    return { interest, events, order };
  }).sort((first, second) => second.events.length - first.events.length || first.order - second.order), [initialEvents]);
  const mapEvents = useMemo(() => initialEvents.filter((event) => {
    if (mapFilter === "free") return event.free;
    if (mapFilter === "live") return matchesInterest(event, interests.find((interest) => interest.id === "live")!);
    return true;
  }), [initialEvents, mapFilter]);
  const selectedMapEvent = mapEvents.find((event) => event.id === selectedMapEventId) || null;
  const activeEvents = useMemo(() => {
    if (!activeInterest) return [];
    const seen = new Set<string>();
    return initialEvents.filter((event) => {
      if (!matchesInterest(event, activeInterest) || seen.has(event.eventId)) return false;
      seen.add(event.eventId);
      return true;
    });
  }, [activeInterest, initialEvents]);
  const activeEvent = activeEvents[eventIndex];
  const nextEvent = activeEvents[eventIndex + 1];
  const activeDiscoveryEvent = activeEvent ? toDiscoveryEvent(activeEvent) : undefined;
  const nextDiscoveryEvent = nextEvent ? toDiscoveryEvent(nextEvent) : undefined;
  const activeBundle = activeEvent ? initialBundles.find((bundle) => bundle.event.id === activeEvent.eventId) : undefined;
  const openInterest = (interest: Interest) => { setActiveInterest(interest); setEventIndex(0); setDragX(0); };
  const closeInterest = () => { setActiveInterest(null); setEventIndex(0); setDragX(0); };
  const move = (direction: -1 | 1) => {
    if (!activeEvents.length) return;
    setEventIndex((current) => Math.max(0, Math.min(activeEvents.length, current + direction)));
    setDragX(0);
  };
  const finishDrag = async (event: PointerEvent<HTMLDivElement>) => {
    if (pointerStart.current === null) return;
    const distance = event.clientX - pointerStart.current;
    pointerStart.current = null;
    setDragging(false);
    if (Math.abs(distance) > 70) {
      if (distance > 0 && activeEvent && !savedIds.has(activeEvent.eventId) && !await toggleSaved(activeEvent.eventId)) { setDragX(0); return; }
      decisionLocked.current = true;
      setDragX(distance > 0 ? 520 : -520);
      window.setTimeout(() => { move(1); decisionLocked.current = false; }, 220);
    } else setDragX(0);
  };
  const openNotifications = async () => {
    if (await requireAuth({ action: "Log in or create an account to see your notifications.", next: "/notifications" })) router.push("/notifications");
  };
  const inviteFriend = async () => {
    if (!activeEvent) return;
    const next = `/events/${activeEvent.eventId}/invite`;
    if (await requireAuth({ action: "Log in or create an account to invite friends.", next })) router.push(next);
  };

  const openDetails = () => {
    if (!activeEvent) return;
    if (!activeBundle) return router.push(`/events/${activeEvent.eventId}`);
    setDetailsOpen(true);
  };

  useEffect(() => {
    if (!detailsOpen) return;
    detailScroller.current?.scrollTo({ top: 0 });
    const scroller = detailScroller.current;
    if (!scroller) return;
    let startY: number | null = null;
    let startedAtTop = false;
    const start = (touchEvent: TouchEvent) => {
      if (touchEvent.touches.length !== 1 || (touchEvent.target as HTMLElement).closest(".event-detail-v2-cover-rail, .event-gallery-screen")) return;
      startY = touchEvent.touches[0].clientY;
      startedAtTop = scroller.scrollTop <= 1;
      detailPullDistance.current = 0;
    };
    const moveDetail = (touchEvent: TouchEvent) => {
      if (startY === null || !startedAtTop || scroller.scrollTop > 1) return;
      const distance = Math.max(0, Math.min(130, touchEvent.touches[0].clientY - startY));
      if (distance > 5) touchEvent.preventDefault();
      detailPullDistance.current = distance;
      setDetailPull(distance);
    };
    const finish = () => {
      if (detailPullDistance.current >= 65) setDetailsOpen(false);
      startY = null;
      detailPullDistance.current = 0;
      setDetailPull(0);
    };
    scroller.addEventListener("touchstart", start, { passive: true });
    scroller.addEventListener("touchmove", moveDetail, { passive: false });
    scroller.addEventListener("touchend", finish, { passive: true });
    scroller.addEventListener("touchcancel", finish, { passive: true });
    return () => {
      scroller.removeEventListener("touchstart", start);
      scroller.removeEventListener("touchmove", moveDetail);
      scroller.removeEventListener("touchend", finish);
      scroller.removeEventListener("touchcancel", finish);
    };
  }, [detailsOpen, activeEvent?.eventId]);

  return <div className={`interest-explore-screen${view === "map" ? " is-map-view" : ""}`}>
    <header className="interest-explore-header"><h1>Explore</h1><div className="interest-explore-view-switch" role="group" aria-label="Explore view"><button type="button" aria-pressed={view === "categories"} onClick={() => setView("categories")}>Categories</button><button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>Map</button></div></header>
    {view === "categories" ? <section className="interest-explore-grid" aria-label="Event interests">
      {interestCards.map(({ interest, events }) => <button type="button" key={interest.id} className="interest-explore-tile" style={{ "--interest-color": interest.color } as CSSProperties} onClick={() => openInterest(interest)}>
        <span className="interest-explore-symbol" aria-hidden="true">{interest.emoji}</span><span className="interest-explore-tile-copy"><strong>{interest.title}</strong><small>{events.length} {events.length === 1 ? "event" : "events"}</small></span>
      </button>)}
    </section> : <section className="interest-explore-map" aria-label="Events map"><div className="interest-explore-map-filters" role="group" aria-label="Map filters">{(["all", "live", "free"] as const).map((filter) => <button type="button" key={filter} aria-pressed={mapFilter === filter} onClick={() => { setMapFilter(filter); setSelectedMapEventId(null); }}>{filter === "all" ? "All events" : filter === "live" ? "Live now" : "Free"}</button>)}</div><div className="interest-explore-map-canvas"><OpenStreetEventMap events={mapEvents} selectedId={selectedMapEventId} onSelect={setSelectedMapEventId} onVisibleEventsChange={() => undefined} />{selectedMapEvent && <button type="button" className="interest-explore-map-card" onClick={() => router.push(`/events/${selectedMapEvent.eventId}`)}><span style={{ backgroundImage: `url(${selectedMapEvent.image})` }} aria-hidden="true" /><p><small>{selectedMapEvent.dateLabel} · {selectedMapEvent.time}</small><strong>{selectedMapEvent.title}</strong><em><DiscoverIcon name="pin" />{selectedMapEvent.venue}</em></p><DiscoverIcon name="chevron" /></button>}{!mapEvents.length && <div className="interest-explore-map-empty">No events match this filter.</div>}</div></section>}

    {activeInterest && <section className="interest-deck" aria-label={`${activeInterest.title} events`}>
      <header><button type="button" aria-label="Close interest" onClick={closeInterest}><DiscoverIcon name="x" /></button><div><h2>{activeInterest.title}</h2></div><button type="button" onClick={() => void openNotifications()} className="interest-deck-notifications" aria-label="Notifications"><DiscoverIcon name="bell" /></button></header>
      {activeEvent && activeDiscoveryEvent ? <>
        <div className="interest-deck-stack">
          {nextEvent && nextDiscoveryEvent && <div key={`next-${nextEvent.eventId}`} className="interest-deck-card is-next" aria-hidden="true"><EventCard event={nextDiscoveryEvent} gallery={nextEvent.media} onOpenDetails={() => undefined} /></div>}
          <div key={activeEvent.eventId} className="interest-deck-card is-active" style={{ transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)`, transition: dragging ? "none" : "transform .2s ease" }} onPointerDown={(event) => { pointerStart.current = event.clientX; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (pointerStart.current !== null) setDragX(Math.max(-150, Math.min(150, event.clientX - pointerStart.current))); }} onPointerUp={finishDrag} onPointerCancel={() => { pointerStart.current = null; setDragging(false); setDragX(0); }}>
            <EventCard event={activeDiscoveryEvent} gallery={activeEvent.media} onOpenDetails={openDetails} />
            <button type="button" className="interest-deck-invite-card" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); void inviteFriend(); }}><DiscoverIcon name="send" />Invite</button>
            <span className="interest-deck-decision interest-deck-go" style={{ opacity: Math.min(1, Math.max(0, dragX / 75)), transform: `translate(-50%,-50%) rotate(-7deg) scale(${.82 + Math.min(1, Math.max(0, dragX / 75)) * .18})` }}>GO</span>
            <span className="interest-deck-decision interest-deck-no" style={{ opacity: Math.min(1, Math.max(0, -dragX / 75)), transform: `translate(-50%,-50%) rotate(7deg) scale(${.82 + Math.min(1, Math.max(0, -dragX / 75)) * .18})` }}>NOT GO</span>
          </div>
        </div>
      </> : <div className="interest-deck-empty"><DiscoverIcon name={activeEvents.length ? "check" : "search"} /><h3>{activeEvents.length ? "You’ve seen every event" : "No matching events yet"}</h3><p>{activeEvents.length ? `That’s everything in ${activeInterest.title.toLowerCase()} for now.` : `New ${activeInterest.title.toLowerCase()} events will appear here.`}</p><button type="button" onClick={closeInterest}>Explore other interests</button></div>}
    </section>}
    {detailsOpen && activeBundle && <div ref={detailScroller} className="discover-inline-detail interest-inline-detail" role="region" aria-label={`${activeBundle.event.title} event details`} style={detailPull ? { transform: `translateY(${detailPull}px)`, transition: "none" } : undefined}>
      <header className="discover-inline-detail-header"><strong>{activeBundle.event.title}</strong><button type="button" onClick={() => setDetailsOpen(false)} aria-label="Return to Explore card"><DiscoverIcon name="arrow-solid" filled /></button></header>
      <EventDetailsScreen event={activeBundle.event} details={activeBundle.details} databaseEventId={activeBundle.databaseId} embedded onClose={() => setDetailsOpen(false)} />
    </div>}
  </div>;
}
