"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { useSavedEvents } from "./SavedEventsProvider";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { EVENT_CATEGORIES } from "@/lib/event-categories";
import { mockEvents } from "@/lib/mock-events";
import { DiscoverIcon } from "./DiscoverIcon";
import { EventCard } from "./EventCard";
import { EventDetailsScreen } from "./EventDetailsScreen";
import { SwipeFeedback } from "./SwipeFeedback";
import type { DiscoveryEvent, EventDetails } from "@/types/event";

const chips = ["For You", "Live", "Tonight", "This Weekend", "Early Bird", "Nearby", "Music"] as const;
const preferenceInterests = EVENT_CATEGORIES;
const datePreferences = [
  ["any", "Any date"],
  ["today", "Today"],
  ["tomorrow", "Tomorrow"],
  ["this-week", "This week"],
  ["weekend", "Weekend"],
  ["next-week", "Next week"],
] as const;
type Direction = "left" | "right";
type DatePreference = (typeof datePreferences)[number][0];
type DiscoverBundle = { event: DiscoveryEvent; details: EventDetails; databaseId: string };

function matchesDatePreference(startsAt: string | undefined, preference: DatePreference) {
  if (preference === "any") return true;
  if (!startsAt) return false;
  const eventTime = new Date(startsAt).getTime();
  if (!Number.isFinite(eventTime)) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayAfterTomorrow = new Date(today); dayAfterTomorrow.setDate(today.getDate() + 2);
  const nextMonday = new Date(today); nextMonday.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
  if (preference === "today") return eventTime >= today.getTime() && eventTime < tomorrow.getTime();
  if (preference === "tomorrow") return eventTime >= tomorrow.getTime() && eventTime < dayAfterTomorrow.getTime();
  if (preference === "this-week") return eventTime >= today.getTime() && eventTime < nextMonday.getTime();
  if (preference === "next-week") { const followingMonday = new Date(nextMonday); followingMonday.setDate(nextMonday.getDate() + 7); return eventTime >= nextMonday.getTime() && eventTime < followingMonday.getTime(); }
  const weekendStart = new Date(today);
  weekendStart.setDate(today.getDate() + (today.getDay() === 0 ? -1 : (6 - today.getDay() + 7) % 7));
  const weekendEnd = new Date(weekendStart); weekendEnd.setDate(weekendStart.getDate() + 2);
  return eventTime >= weekendStart.getTime() && eventTime < weekendEnd.getTime();
}

export function DiscoverExperience({ initialEvents, initialBundles = [], autoDemo = false }: { initialEvents?: readonly DiscoveryEvent[]; initialBundles?: readonly DiscoverBundle[]; autoDemo?: boolean }) {
  const availableEvents = initialEvents ?? (initialBundles.length ? initialBundles.map((bundle) => bundle.event) : mockEvents);
  const [eventIndex, setEventIndex] = useState(0);
  const [selectedChip, setSelectedChip] = useState<(typeof chips)[number]>("For You");
  const { savedIds, toggleSaved } = useSavedEvents();
  const { requireAuth } = useAuthGate();
  const router = useRouter();
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<Direction | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailPull, setDetailPull] = useState(0);
  const [detailSwipeX, setDetailSwipeX] = useState(0);
  const [detailExitDirection, setDetailExitDirection] = useState<Direction | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("Koh Phangan");
  const [currentLocationLabel, setCurrentLocationLabel] = useState("Koh Phangan");
  const [currentCoordinates, setCurrentCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [maxDistance, setMaxDistance] = useState(100);
  const [pricePreference, setPricePreference] = useState<"any" | "free" | "paid">("any");
  const [crowdPreference, setCrowdPreference] = useState<"any" | "small" | "large">("any");
  const [audiencePreference, setAudiencePreference] = useState<"all" | "women" | "men">("all");
  const [datePreference, setDatePreference] = useState<DatePreference>("any");
  const [interestPreferences, setInterestPreferences] = useState<string[]>([]);
  const [preferencesExpanded, setPreferencesExpanded] = useState(false);
  const [preferencesDragY, setPreferencesDragY] = useState(0);
  const [preferencesDragging, setPreferencesDragging] = useState(false);
  const chipDrag = useRef<{ x: number; scrollLeft: number } | null>(null);
  const chipsDragged = useRef(false);
  const pointerStart = useRef<{ x: number; y: number; axis: "horizontal" | "vertical" | null } | null>(null);
  const detailSwipeDistance = useRef(0);
  const detailPullDistance = useRef(0);
  const detailScroller = useRef<HTMLDivElement>(null);
  const preferencesDragStart = useRef<number | null>(null);
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eligibleEvents = useMemo(() => availableEvents.filter((item) => {
    if (currentCoordinates && item.latitude != null && item.longitude != null) {
      const toRadians = (value: number) => value * Math.PI / 180;
      const dLat = toRadians(item.latitude - currentCoordinates.latitude);
      const dLon = toRadians(item.longitude - currentCoordinates.longitude);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(currentCoordinates.latitude)) * Math.cos(toRadians(item.latitude)) * Math.sin(dLon / 2) ** 2;
      if (6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) > 100) return false;
    } else if (!item.location.toLowerCase().includes(selectedLocation.toLowerCase())) return false;
    if (audiencePreference !== "all" && item.audience !== audiencePreference) return false;
    if (selectedChip === "Live") {
      // The live window must be evaluated against the time of the current render.
      // eslint-disable-next-line react-hooks/purity
      const now = Date.now();
      if (!(item.liveDiscoveryEnabled && item.startsAt && item.endsAt && new Date(item.startsAt).getTime() <= now && new Date(item.endsAt).getTime() >= now)) return false;
    }
    if (selectedChip === "Music" && !item.tags.includes("Music")) return false;
    const distance = Number.parseFloat(item.distance);
    if (Number.isFinite(distance) && distance > maxDistance) return false;
    if (pricePreference === "free" && item.price !== "Free") return false;
    if (pricePreference === "paid" && item.price === "Free") return false;
    if (crowdPreference === "small" && item.attendeeCount >= 100) return false;
    if (crowdPreference === "large" && item.attendeeCount < 100) return false;
    if (!matchesDatePreference(item.startsAt, datePreference)) return false;
    if (interestPreferences.length && !interestPreferences.some((interest) => item.tags.some((tag) => tag.toLowerCase() === interest.toLowerCase()))) return false;
    return true;
  }), [availableEvents, selectedChip, selectedLocation, currentCoordinates, maxDistance, pricePreference, crowdPreference, audiencePreference, datePreference, interestPreferences]);
  const event = eligibleEvents[eventIndex % eligibleEvents.length];
  const nextEvent = eligibleEvents[(eventIndex + 1) % eligibleEvents.length];
  const saved = event ? savedIds.has(event.id) : false;
  const detailBundle = event ? initialBundles.find((bundle) => bundle.event.id === event.id) : undefined;
  const nextDetailBundle = nextEvent ? initialBundles.find((bundle) => bundle.event.id === nextEvent.id) : undefined;
  const currentEventRef = useRef(event);
  const currentSavedRef = useRef(saved);
  const toggleSavedRef = useRef(toggleSaved);

  useEffect(() => () => { if (animationTimer.current) clearTimeout(animationTimer.current); }, []);
  useEffect(() => {
    currentEventRef.current = event;
    currentSavedRef.current = saved;
    toggleSavedRef.current = toggleSaved;
  }, [event, saved, toggleSaved]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedLocation = window.localStorage.getItem("attnd:discover-location");
      if (storedLocation && storedLocation !== "Current location") setSelectedLocation(storedLocation);
      else if (storedLocation === "Current location") window.localStorage.removeItem("attnd:discover-location");
      void import("@/lib/supabase/client").then(async ({ createClient }) => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("city").eq("id", user.id).maybeSingle();
        if (profile?.city) {
          setCurrentLocationLabel(profile.city);
          if (!storedLocation || storedLocation === "Current location") setSelectedLocation(profile.city);
        }
      }).catch(() => {});
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!detailsOpen) return;
    const frame = window.requestAnimationFrame(() => detailScroller.current?.scrollTo({ top: 0 }));
    return () => window.cancelAnimationFrame(frame);
  }, [detailsOpen, event?.id]);

  useEffect(() => {
    if (!detailsOpen) return;
    const scroller = detailScroller.current;
    if (!scroller) return;

    let gesture: { x: number; y: number; atTop: boolean; axis: "horizontal" | "vertical" | null } | null = null;

    const resetGesture = () => {
      gesture = null;
      detailSwipeDistance.current = 0;
      detailPullDistance.current = 0;
      setDetailPull(0);
      setDetailSwipeX(0);
    };

    const startGesture = (touchEvent: TouchEvent) => {
      if (touchEvent.touches.length !== 1) return;
      const target = touchEvent.target as HTMLElement;
      if (target.closest(".event-detail-v2-cover-rail, .event-gallery-screen")) return;
      const touch = touchEvent.touches[0];
      gesture = { x: touch.clientX, y: touch.clientY, atTop: scroller.scrollTop <= 1, axis: null };
      detailSwipeDistance.current = 0;
      detailPullDistance.current = 0;
    };

    const moveGesture = (touchEvent: TouchEvent) => {
      if (!gesture || touchEvent.touches.length !== 1) return;
      const touch = touchEvent.touches[0];
      const dx = touch.clientX - gesture.x;
      const dy = touch.clientY - gesture.y;
      if (!gesture.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 7) {
        gesture.axis = Math.abs(dx) > Math.abs(dy) * 1.05 ? "horizontal" : "vertical";
      }
      if (gesture.axis === "horizontal") {
        touchEvent.preventDefault();
        touchEvent.stopPropagation();
        const distance = Math.max(-180, Math.min(180, dx));
        detailSwipeDistance.current = distance;
        setDetailSwipeX(distance);
        return;
      }
      if (gesture.axis === "vertical" && gesture.atTop && scroller.scrollTop <= 1) {
        const distance = Math.max(0, Math.min(120, dy));
        detailPullDistance.current = distance;
        setDetailPull(distance);
      }
    };

    const endGesture = async () => {
      if (!gesture) return;
      if (gesture.axis === "horizontal" && Math.abs(detailSwipeDistance.current) >= 55 && eligibleEvents.length > 1) {
        const direction: Direction = detailSwipeDistance.current < 0 ? "left" : "right";
        const currentEvent = currentEventRef.current;
        if (direction === "right" && currentEvent && !currentSavedRef.current && !await toggleSavedRef.current(currentEvent.id)) {
          resetGesture();
          return;
        }
        setDetailExitDirection(direction);
        setAnnouncement(direction === "right" ? `${currentEvent?.title ?? "Event"} saved` : `Not interested in ${currentEvent?.title ?? "event"}`);
        animationTimer.current = setTimeout(() => {
          setEventIndex((current) => (current + 1) % eligibleEvents.length);
          setDetailsOpen(false);
          setDetailExitDirection(null);
          resetGesture();
        }, 280);
        gesture = null;
        return;
      } else if (detailPullDistance.current >= 65) {
        setDetailsOpen(false);
      }
      resetGesture();
    };

    scroller.addEventListener("touchstart", startGesture, { capture: true, passive: true });
    scroller.addEventListener("touchmove", moveGesture, { capture: true, passive: false });
    scroller.addEventListener("touchend", endGesture, { capture: true, passive: true });
    scroller.addEventListener("touchcancel", resetGesture, { capture: true, passive: true });
    return () => {
      scroller.removeEventListener("touchstart", startGesture, true);
      scroller.removeEventListener("touchmove", moveGesture, true);
      scroller.removeEventListener("touchend", endGesture, true);
      scroller.removeEventListener("touchcancel", resetGesture, true);
    };
  }, [detailsOpen, eligibleEvents.length]);

  function chooseLocation(location: string) {
    setCurrentCoordinates(null);
    setSelectedLocation(location);
    setEventIndex(0);
    setDragX(0);
    setExitDirection(null);
    window.localStorage.setItem("attnd:discover-location", location);
    setLocationOpen(false);
    setAnnouncement(`Location changed to ${location}`);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return setAnnouncement("Location is not available on this device.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const kohPhanganCenter = { latitude: 9.7319, longitude: 100.0136 };
        const toRadians = (value: number) => value * Math.PI / 180;
        const dLat = toRadians(coords.latitude - kohPhanganCenter.latitude);
        const dLon = toRadians(coords.longitude - kohPhanganCenter.longitude);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(kohPhanganCenter.latitude)) * Math.cos(toRadians(coords.latitude)) * Math.sin(dLon / 2) ** 2;
        const distanceFromKohPhangan = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const resolvedLocation = distanceFromKohPhangan < 55 ? "Koh Phangan" : currentLocationLabel;
        setCurrentCoordinates({ latitude: coords.latitude, longitude: coords.longitude });
        setCurrentLocationLabel(resolvedLocation);
        setSelectedLocation(resolvedLocation);
        setEventIndex(0);
        setDragX(0);
        setExitDirection(null);
        window.localStorage.setItem("attnd:discover-location", resolvedLocation);
        setLocationOpen(false);
        setAnnouncement(`Location changed to ${resolvedLocation}`);
      },
      () => setAnnouncement("Location access was not granted. Choose a city instead."),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  function startPreferencesDrag(event: PointerEvent<HTMLElement>) {
    preferencesDragStart.current = event.clientY;
    setPreferencesDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePreferencesDrag(event: PointerEvent<HTMLElement>) {
    if (preferencesDragStart.current === null) return;
    setPreferencesDragY(Math.max(-70, Math.min(260, event.clientY - preferencesDragStart.current)));
  }

  function finishPreferencesDrag() {
    if (preferencesDragStart.current === null) return;
    if (preferencesDragY > 115) {
      setPreferencesOpen(false);
      setPreferencesExpanded(false);
    }
    else if (preferencesDragY < -35) setPreferencesExpanded(true);
    else if (preferencesDragY > 45) setPreferencesExpanded(false);
    preferencesDragStart.current = null;
    setPreferencesDragging(false);
    setPreferencesDragY(0);
  }

  useEffect(() => {
    if (!autoDemo || eligibleEvents.length < 2) return;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;
    const swipe = () => {
      setExitDirection("right");
      resetTimer = setTimeout(() => {
        setEventIndex((current) => (current + 1) % eligibleEvents.length);
        setDragX(0);
        setExitDirection(null);
      }, 620);
    };
    const firstSwipe = setTimeout(swipe, 1500);
    const interval = setInterval(swipe, 4200);
    return () => { clearTimeout(firstSwipe); clearInterval(interval); if (resetTimer) clearTimeout(resetTimer); };
  }, [autoDemo, eligibleEvents.length]);

  async function openNotifications() {
    if (await requireAuth({ action: "Log in or create an account to see your notifications.", next: "/notifications" })) router.push("/notifications");
  }

  function openCurrentDetails() {
    if (detailBundle) setDetailsOpen(true);
    else if (event) router.push(`/events/${event.id}`);
  }

  async function advance(direction: Direction) {
    if (exitDirection || !event || !eligibleEvents.length) return;
    if (direction === "right" && !saved && !await toggleSaved(event.id)) return;
    void fetch("/api/points/swipe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: event.id, direction }) }).catch(() => undefined);
    setExitDirection(direction);
    setAnnouncement(direction === "left" ? `Not interested in ${event.title}` : `${event.title} saved`);
    animationTimer.current = setTimeout(() => {
      setEventIndex((current) => (current + 1) % eligibleEvents.length);
      setDragX(0);
      setExitDirection(null);
    }, 440);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (exitDirection || (e.target as HTMLElement).closest("button, a")) return;
    pointerStart.current = { x: e.clientX, y: e.clientY, axis: null };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (pointerStart.current === null || exitDirection) return;
    const distanceX = e.clientX - pointerStart.current.x;
    const distanceY = e.clientY - pointerStart.current.y;
    if (!pointerStart.current.axis && Math.max(Math.abs(distanceX), Math.abs(distanceY)) > 8) pointerStart.current.axis = Math.abs(distanceY) > Math.abs(distanceX) ? "vertical" : "horizontal";
    if (!pointerStart.current.axis) return;
    if (pointerStart.current.axis === "vertical") {
      setDetailPull(Math.max(0, Math.min(120, -distanceY)));
      return;
    }
    setDragX(Math.max(-180, Math.min(180, distanceX)));
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (pointerStart.current === null) return;
    const distance = e.clientX - pointerStart.current.x;
    const verticalDistance = e.clientY - pointerStart.current.y;
    const axis = pointerStart.current.axis;
    pointerStart.current = null;
    setIsDragging(false);
    setDetailPull(0);
    if (axis === "vertical" && verticalDistance <= -65) {
      if (detailBundle) setDetailsOpen(true);
      else if (event) router.push(`/events/${event.id}`);
    } else if (axis === "horizontal" && Math.abs(distance) >= 85) advance(distance < 0 ? "left" : "right");
    else setDragX(0);
  }

  const direction = exitDirection ?? (dragX < -8 ? "left" : dragX > 8 ? "right" : null);
  const swipeProgress = exitDirection ? 1 : Math.min(1, Math.max(0, (Math.abs(dragX) - 8) / 77));
  const detailSwipeDirection = detailSwipeX < -7 ? "left" : detailSwipeX > 7 ? "right" : null;
  const detailSwipeProgress = Math.min(1, Math.max(0, (Math.abs(detailSwipeX) - 7) / 48));
  const detailCardX = detailExitDirection ? (detailExitDirection === "left" ? "-125%" : "125%") : `${detailSwipeX}px`;
  const detailCardRotation = detailExitDirection ? (detailExitDirection === "left" ? -11 : 11) : detailSwipeX / 24;
  const cardX = exitDirection ? (exitDirection === "left" ? "-140%" : "140%") : `${dragX}px`;
  const cardRotation = exitDirection ? (exitDirection === "left" ? -12 : 12) : dragX / 18;

  return (
    <div className="discover-screen mx-auto max-w-xl">
      <header className="discover-topbar flex items-start justify-between gap-3">
        <div className="discover-topbar-left">
          <button type="button" className="discover-preferences-trigger" aria-expanded={preferencesOpen} onClick={() => setPreferencesOpen(true)}><DiscoverIcon name="sliders" />Preferences</button>
          <button type="button" aria-label={`Change location. Current location: ${selectedLocation}`} aria-expanded={locationOpen} onClick={() => setLocationOpen(true)} className="flex h-6 items-center gap-2 text-[15px] leading-5 font-semibold text-foreground">
            <DiscoverIcon name="pin" className="h-5 w-5" />{selectedLocation}<DiscoverIcon name="chevron" className="h-4 w-4 -rotate-90" />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-1">
          <button type="button" onClick={() => void openNotifications()} aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center text-foreground"><DiscoverIcon name="bell" className="h-6 w-6" /></button>
        </div>
      </header>

      <div aria-label="Discovery categories" className="discover-categories flex cursor-grab justify-start gap-1.5 overflow-x-auto overscroll-x-contain select-none active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onPointerDown={(e) => {
          chipsDragged.current = false;
          if (e.pointerType === "mouse" && e.button === 0) chipDrag.current = { x: e.clientX, scrollLeft: e.currentTarget.scrollLeft };
        }}
        onPointerMove={(e) => {
          if (!chipDrag.current) return;
          const delta = e.clientX - chipDrag.current.x;
          if (Math.abs(delta) > 5) {
            chipsDragged.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            e.currentTarget.scrollLeft = chipDrag.current.scrollLeft - delta;
          }
        }}
        onPointerUp={() => { chipDrag.current = null; }}
        onPointerCancel={() => { chipDrag.current = null; }}
        onClickCapture={(e) => { if (chipsDragged.current) { e.preventDefault(); e.stopPropagation(); } }}>
        {chips.map((chip) => <button key={chip} type="button" onClick={() => { setSelectedChip(chip); setEventIndex(0); setDragX(0); setExitDirection(null); }} aria-pressed={selectedChip === chip} className={`shrink-0 rounded-full font-medium transition-colors ${selectedChip === chip ? "bg-black/45 text-white" : "text-white/80 hover:text-white"}`}>{chip}</button>)}
      </div>

      {event && nextEvent ? <section aria-label="Event" className="discover-card-stage relative">
        <div className="discover-deck-card" aria-hidden="true" inert><EventCard event={nextEvent} gallery={nextDetailBundle?.details.media || nextDetailBundle?.details.photos} /></div>
        <div key={event.id} className="discover-drag-card relative cursor-grab select-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" tabIndex={0} role="group" aria-label={`${event.title}. Tap the left or right side to browse photos. Swipe left or right to browse events. Swipe up for event details. Keyboard: use left and right arrow keys, or Enter to view details.`} onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === "ArrowUp") { e.preventDefault(); openCurrentDetails(); } if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); advance(e.key === "ArrowLeft" ? "left" : "right"); } }} style={{ touchAction: "none", transform: `translate3d(${cardX}, ${-detailPull * .35}px, 0) rotate(${cardRotation}deg)`, transition: exitDirection ? "transform 280ms ease-in 160ms, opacity 280ms ease-in 160ms" : isDragging ? "none" : "transform 220ms ease-out", opacity: exitDirection ? 0 : 1 }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { pointerStart.current = null; setIsDragging(false); setDragX(0); setDetailPull(0); }}>
          <EventCard event={event} gallery={detailBundle?.details.media || detailBundle?.details.photos} onOpenDetails={openCurrentDetails} />
        </div>
        <SwipeFeedback direction={direction} progress={swipeProgress} committed={!!exitDirection} />
      </section> : <div className="discover-empty-state"><h2>No events in {selectedLocation}</h2><p>Try another location or check back soon.</p><button type="button" onClick={() => setLocationOpen(true)}>Change location</button></div>}

      {detailsOpen && detailBundle && <div ref={detailScroller} className="discover-inline-detail" role="region" aria-label={`${event.title} event details`} data-swiping={Boolean(detailSwipeDirection || detailExitDirection)} style={detailPull || detailSwipeX || detailExitDirection ? { transform: `translate3d(${detailCardX}, ${detailPull}px, 0) rotate(${detailCardRotation}deg)`, transformOrigin: "50% 85%", transition: detailExitDirection ? "transform 280ms cubic-bezier(.32,.72,.12,1)" : "none" } : undefined}>
        <header className="discover-inline-detail-header"><strong>{event.title}</strong><button type="button" onClick={() => setDetailsOpen(false)} aria-label="Return to event cards"><DiscoverIcon name="arrow-solid" filled /></button></header>
        <EventDetailsScreen event={detailBundle.event} details={detailBundle.details} databaseEventId={detailBundle.databaseId} embedded onClose={() => setDetailsOpen(false)} />
      </div>}
      {detailsOpen && detailSwipeDirection && <div className={`discover-detail-swipe-feedback ${detailSwipeDirection === "right" ? "is-go" : "is-no"}`} aria-hidden="true" style={{ opacity: detailSwipeProgress, transform: `translateX(${detailSwipeX * .22}px) scale(${.82 + detailSwipeProgress * .18})` }}><span>{detailSwipeDirection === "right" ? "GO" : "NOT GO"}</span></div>}

      {locationOpen && <div className="discover-location-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLocationOpen(false); }}>
        <section className="discover-location-picker" role="dialog" aria-modal="true" aria-label="Choose location">
          <i className="discover-location-handle" />
          <header><div><h2>Location</h2><p>Use your position for nearby events or browse Koh Phangan.</p></div><button type="button" aria-label="Close location picker" onClick={() => setLocationOpen(false)}><DiscoverIcon name="x" /></button></header>
          <button type="button" className="discover-use-location" onClick={useCurrentLocation}><DiscoverIcon name="locate" /><span><strong>Living in {currentLocationLabel}</strong><small>Use your position to update your local events</small></span></button>
          <div className="discover-location-options"><button type="button" aria-pressed={selectedLocation === "Koh Phangan"} onClick={() => chooseLocation("Koh Phangan")}><DiscoverIcon name="pin" /><span>Koh Phangan<small>Available now</small></span>{selectedLocation === "Koh Phangan" && <DiscoverIcon name="check" />}</button></div>
        </section>
      </div>}

      {preferencesOpen && <div className="discover-preferences-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreferencesOpen(false); }}>
        <section className={`discover-preferences-sheet${preferencesExpanded ? " is-expanded" : ""}`} role="dialog" aria-modal="true" aria-labelledby="discover-preferences-title" style={{ transform: `translateY(${Math.max(0, preferencesDragY)}px)`, transition: preferencesDragging ? "none" : "transform .2s ease,max-height .24s ease" }}>
          <button type="button" className="discover-sheet-handle" aria-label="Drag preferences up or down" onPointerDown={startPreferencesDrag} onPointerMove={movePreferencesDrag} onPointerUp={finishPreferencesDrag} onPointerCancel={finishPreferencesDrag} />
          <header><h2 id="discover-preferences-title">Preferences</h2><button type="button" aria-label="Close preferences" onClick={() => setPreferencesOpen(false)}><DiscoverIcon name="x" /></button></header>
          <div className="discover-preferences-content">
            <div className="discover-preference-block"><div className="discover-preference-label"><span>Date</span><strong>{datePreferences.find(([value]) => value === datePreference)?.[1]}</strong></div><div className="discover-preference-dates">{datePreferences.map(([value, label]) => <button key={value} type="button" aria-pressed={datePreference === value} onClick={() => setDatePreference(value)}>{label}</button>)}</div></div>
            <div className="discover-preference-block"><div className="discover-preference-label"><span>Audience</span><strong>{audiencePreference === "all" ? "All" : audiencePreference === "women" ? "Women only" : "Men only"}</strong></div><div className="discover-preference-options">{([['all','All'],['women','Women only'],['men','Men only']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={audiencePreference === value} onClick={() => setAudiencePreference(value)}>{label}</button>)}</div></div>
            <div className="discover-preference-block"><div className="discover-preference-label"><span>Maximum distance</span><strong>{maxDistance} km</strong></div><input aria-label="Maximum distance" type="range" min="1" max="100" value={maxDistance} onChange={(event) => setMaxDistance(Number(event.target.value))} /><p>Only show events within this distance when a distance is available.</p></div>
            <div className="discover-preference-block"><div className="discover-preference-label"><span>Price</span><strong>{pricePreference === "any" ? "Any" : pricePreference === "free" ? "Free" : "Paid"}</strong></div><div className="discover-preference-options">{(["any", "free", "paid"] as const).map((value) => <button key={value} type="button" aria-pressed={pricePreference === value} onClick={() => setPricePreference(value)}>{value === "any" ? "Any price" : value === "free" ? "Free" : "Paid"}</button>)}</div></div>
            <div className="discover-preference-block"><div className="discover-preference-label"><span>Crowd size</span><strong>{crowdPreference === "any" ? "Any" : crowdPreference === "small" ? "Under 100" : "100+"}</strong></div><div className="discover-preference-options">{(["any", "small", "large"] as const).map((value) => <button key={value} type="button" aria-pressed={crowdPreference === value} onClick={() => setCrowdPreference(value)}>{value === "any" ? "Any size" : value === "small" ? "Under 100" : "100+ people"}</button>)}</div></div>
            <div className="discover-preference-block"><div className="discover-preference-label"><span>Interests</span><strong>{interestPreferences.length ? `${interestPreferences.length} selected` : "All"}</strong></div><div className="discover-preference-interests">{preferenceInterests.map((interest) => <button key={interest} type="button" aria-pressed={interestPreferences.includes(interest)} onClick={() => setInterestPreferences((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest])}>{interest}</button>)}</div></div>
          </div>
          <footer><button type="button" onClick={() => { setMaxDistance(100); setPricePreference("any"); setCrowdPreference("any"); setAudiencePreference("all"); setDatePreference("any"); setInterestPreferences([]); }}>Reset</button><button type="button" onClick={() => setPreferencesOpen(false)}>Show events</button></footer>
        </section>
      </div>}

      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    </div>
  );
}
