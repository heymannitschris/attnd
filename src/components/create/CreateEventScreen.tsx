"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";
import { EVENT_CATEGORIES } from "@/lib/event-categories";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { MAX_VIDEO_SOURCE_BYTES, optimizeVideo } from "@/lib/video-compression";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type EventKind = "single" | "series";
type LocationKind = "venue" | "online";
type TicketKind = "paid" | "free";
type MediaCategory = "Venue" | "Stage" | "People" | "Atmosphere" | "Location" | "UGC";
type MediaItem = { id: string; src: string; kind: "photo" | "video"; description: string; category: MediaCategory; file?: File };
type LineupItem = { id: string; time: string; title: string };
type DateInfo = { startDate: string; endDate: string; startTime: string; endTime: string; timezone: string };
type LocationInfo = { venueName: string; address: string; city: string; latitude: number; longitude: number; googleMapsUrl: string; onlineUrl: string; locationNotes: string };
type SavedEventDraft = { id?: string; step: Step; category: string; targetAudience: "all" | "women" | "men"; title: string; description: string; eventKind: EventKind; dateInfo?: DateInfo; locationKind: LocationKind; locationInfo?: LocationInfo; ticketKind: TicketKind; tickets: string[]; lineup: LineupItem[]; expectations: string[]; affiliateCommission?: number; liveDiscoveryEnabled?: boolean; ticketSalesDuringEvent?: boolean };
const draftStorageKey = "attnd:event-draft";
const initialDateInfo: DateInfo = { startDate: "", endDate: "", startTime: "", endTime: "", timezone: "Asia/Bangkok" };
const initialLocationInfo: LocationInfo = { venueName: "", address: "", city: "Koh Phangan", latitude: 9.676, longitude: 100.066, googleMapsUrl: "", onlineUrl: "", locationNotes: "" };
const initialLineup: LineupItem[] = [{ id: "welcome", time: "17:30", title: "Welcome & arrival" }, { id: "main", time: "18:00", title: "Main session" }, { id: "close", time: "19:15", title: "Closing & connection" }];
const initialExpectations = ["A welcoming community", "Everything you need is provided", "Time to connect with other guests"];

const steps = ["Basic", "Date", "Location", "Gallery", "Schedule", "Expect", "Tickets", "Affiliates", "Publish"] as const;
const stepEmojis = ["📝", "📅", "📍", "🖼️", "🗓️", "✨", "🎟️", "🤝", "🚀"] as const;
const categories = EVENT_CATEGORIES;
const initialMedia: MediaItem[] = [];

export function CreateEventScreen() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [published, setPublished] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [category, setCategory] = useState("");
  const [targetAudience, setTargetAudience] = useState<"all" | "women" | "men">("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventKind, setEventKind] = useState<EventKind>("single");
  const [dateInfo, setDateInfo] = useState<DateInfo>(initialDateInfo);
  const [locationKind, setLocationKind] = useState<LocationKind>("venue");
  const [locationInfo, setLocationInfo] = useState<LocationInfo>(initialLocationInfo);
  const saveEventRef = useRef<(status: "draft" | "published") => Promise<void>>(async () => {});
  const [databaseEventId, setDatabaseEventId] = useState<string | undefined>();
  const [existingStatus, setExistingStatus] = useState<"draft" | "published">("draft");
  const [publishedSlug, setPublishedSlug] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [saveError, setSaveError] = useState("");
  const [publishWarning, setPublishWarning] = useState("");
  const [ticketKind, setTicketKind] = useState<TicketKind>("free");
  const [addTicket, setAddTicket] = useState(false);
  const [ticketName, setTicketName] = useState("");
  const [ticketPrice, setTicketPrice] = useState("");
  const [ticketQuantity, setTicketQuantity] = useState("100");
  const [editingTicketIndex, setEditingTicketIndex] = useState<number | null>(null);
  const [tickets, setTickets] = useState<string[]>([]);
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [mediaError, setMediaError] = useState("");
  const [mediaProcessing, setMediaProcessing] = useState("");
  const [lineup, setLineup] = useState<LineupItem[]>(initialLineup);
  const [expectations, setExpectations] = useState(initialExpectations);
  const [affiliateCommission, setAffiliateCommission] = useState(25);
  const [liveDiscoveryEnabled, setLiveDiscoveryEnabled] = useState(false);
  const [ticketSalesDuringEvent, setTicketSalesDuringEvent] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("step");
    const requestedStep = ({ basic: 1, date: 2, location: 3, gallery: 4, schedule: 5, expect: 6, tickets: 7, affiliates: 8, publish: 9 } as const)[requested as "basic"];
    if (!requestedStep) return;
    const timer = window.setTimeout(() => setStep(requestedStep), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      const requestedId = new URLSearchParams(window.location.search).get("id");
      if (!requestedId) return;
      setStarted(true);
      if (requestedId && hasSupabaseConfig) {
        try {
          const response = await fetch(`/api/events?id=${encodeURIComponent(requestedId)}`);
          const result = await response.json() as { event?: Record<string, unknown> & { ticket_types?: Array<Record<string, unknown>>; event_media?: Array<Record<string, unknown>> }; error?: string };
          if (!response.ok || !result.event) throw new Error(result.error || "Could not load draft");
          if (!active) return;
          const event = result.event;
          const dateParts = (value: unknown) => typeof value === "string" ? { date: value.slice(0, 10), time: new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) } : { date: "", time: "" };
          const start = dateParts(event.starts_at); const end = dateParts(event.ends_at);
          setDatabaseEventId(String(event.id)); setExistingStatus(event.status === "published" ? "published" : "draft"); setTitle(String(event.title || "")); setDescription(String(event.description || "")); setCategory(String(event.category || ""));
          setTargetAudience((event.audience as "all" | "women" | "men") || "all"); setEventKind((event.event_kind as EventKind) || "single");
          setDateInfo({ startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time, timezone: String(event.timezone || "Asia/Bangkok") });
          setLocationKind("venue");
          setLocationInfo({ venueName: String(event.venue_name || ""), address: String(event.address || ""), city: String(event.city || ""), latitude: Number(event.latitude) || initialLocationInfo.latitude, longitude: Number(event.longitude) || initialLocationInfo.longitude, googleMapsUrl: String(event.google_maps_url || ""), onlineUrl: String(event.online_url || ""), locationNotes: String(event.location_notes || "") });
          const loadedTickets = (event.ticket_types || []).filter((ticket) => ticket.active !== false).map((ticket) => `${String(ticket.name)} · ฿${new Intl.NumberFormat("en-US").format(Number(ticket.price_minor || 0) / 100)} · ${Number(ticket.quantity || 1)}`);
          setTickets(loadedTickets); setTicketKind(loadedTickets.some((ticket) => !ticket.includes("· ฿0 ·")) ? "paid" : "free");
          setLineup(Array.isArray(event.schedule) ? event.schedule as LineupItem[] : []); setExpectations(Array.isArray(event.expectations) ? event.expectations.map(String) : []); setAffiliateCommission(Number(event.affiliate_commission) || 0);
          setLiveDiscoveryEnabled(Boolean(event.live_discovery_enabled)); setTicketSalesDuringEvent(Boolean(event.ticket_sales_during_event));
          setMedia((event.event_media || []).sort((a, b) => Number(a.position) - Number(b.position)).map((item) => ({ id: String(item.id), src: String(item.public_url), kind: item.kind === "video" ? "video" : "photo", category: String(item.category || "Atmosphere") as MediaCategory, description: String(item.description || "") })));
          const requestedStepName = new URLSearchParams(window.location.search).get("step");
          const requestedStep = ({ basic: 1, date: 2, location: 3, gallery: 4, schedule: 5, expect: 6, tickets: 7, affiliates: 8, publish: 9 } as const)[requestedStepName as "basic"];
          setStep(requestedStep || 1); setDraftReady(true); return;
        } catch (error) { if (active) setSaveStatus(error instanceof Error ? error.message : "Could not load draft"); }
      }
      if (active) setDraftReady(true);
    };
    void hydrate();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!started || !draftReady || published) return;
    const draft: SavedEventDraft = { id: databaseEventId, step, category, targetAudience, title, description, eventKind, dateInfo, locationKind, locationInfo, ticketKind, tickets, lineup, expectations, affiliateCommission, liveDiscoveryEnabled, ticketSalesDuringEvent };
    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    const timer = window.setTimeout(() => { if (hasSupabaseConfig && title.trim() && existingStatus === "draft") void saveEventRef.current("draft"); }, 900);
    return () => window.clearTimeout(timer);
  }, [started, draftReady, published, step, category, targetAudience, title, description, eventKind, dateInfo, locationKind, locationInfo, ticketKind, tickets, lineup, expectations, affiliateCommission, liveDiscoveryEnabled, ticketSalesDuringEvent, databaseEventId, existingStatus]);

  function beginNewEvent() {
    window.localStorage.removeItem(draftStorageKey);
    setStep(1); setCategory(""); setTargetAudience("all"); setTitle(""); setDescription(""); setEventKind("single"); setDateInfo(initialDateInfo); setLocationKind("venue"); setLocationInfo(initialLocationInfo);
    setDatabaseEventId(undefined); setExistingStatus("draft"); setSaveStatus(""); setSaveError(""); setTicketKind("free"); setTickets([]); setMedia([]); setMediaError(""); setMediaProcessing(""); setLineup(initialLineup); setExpectations(initialExpectations); setAffiliateCommission(25); setLiveDiscoveryEnabled(false); setTicketSalesDuringEvent(false);
    setDraftReady(true); setStarted(true);
  }

  function next() { setStep((current) => Math.min(9, current + 1) as Step); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function previous() { if (step === 1) return; setStep((current) => Math.max(1, current - 1) as Step); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function saveTicket() {
    if (ticketName.trim()) {
      const value = `${ticketName} · ฿${ticketPrice || "0"} · ${ticketQuantity || "100"}`;
      setTickets((current) => editingTicketIndex === null ? [...current, value] : current.map((ticket, index) => index === editingTicketIndex ? value : ticket));
    }
    setTicketName(""); setTicketPrice(""); setTicketQuantity("100"); setEditingTicketIndex(null); setAddTicket(false);
  }
  function editTicket(index: number) {
    const [name, price, quantity] = tickets[index].split(" · ");
    setTicketName(name); setTicketPrice(price.replace(/[฿$,]/g, "")); setTicketQuantity(quantity); setEditingTicketIndex(index); setAddTicket(true);
  }
  function updateMedia(id: string, patch: Partial<MediaItem>) { setMedia((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)); }
  function moveMedia(id: string, direction: -1 | 1) {
    setMedia((current) => {
      const index = current.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
  }
  const ticketPayload = () => ticketKind === "free"
    ? [{ name: "Free Admission", description: "Reserve your spot", priceMinor: 0, currency: "thb", quantity: 100 }]
    : tickets.map((ticket) => { const [name, price, quantity] = ticket.split(" · "); return { name, priceMinor: Math.round(Number(price.replace(/[^0-9.]/g, "")) * 100), currency: "thb", quantity: Math.max(1, Number(quantity.replace(/\D/g, "")) || 100) }; });
  function validatePublish() {
    if (!title.trim() || !category) return { message: "Add an event title and select an event type.", step: 1 as Step };
    if (!dateInfo.startDate || !dateInfo.startTime || !dateInfo.endTime) return { message: "Add the event date, start time and end time.", step: 2 as Step };
    if (locationKind === "venue" && (!locationInfo.venueName.trim() || !locationInfo.city.trim())) return { message: "Add the venue name and city.", step: 3 as Step };
    if (locationKind === "online" && !locationInfo.onlineUrl.trim()) return { message: "Add the online event link.", step: 3 as Step };
    if (ticketKind === "paid" && !tickets.some((ticket) => ticket.split(" · ")[0]?.trim())) return { message: "Add at least one paid ticket type.", step: 7 as Step };
    return null;
  }
  async function saveEvent(status: "draft" | "published") {
    if (status === "published") {
      const validation = validatePublish();
      if (validation) { setSaveStatus(""); setSaveError(validation.message); return; }
    }
    setSaveError("");
    setPublishWarning("");
    setSaveStatus(status === "published" ? "Publishing…" : "Saving…");
    try {
      const response = await fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        id: databaseEventId, status, title, description, category, audience: targetAudience, eventKind, ...dateInfo,
        locationKind, ...locationInfo, schedule: lineup, expectations, affiliateCommission, liveDiscoveryEnabled, ticketSalesDuringEvent, tickets: ticketPayload(),
      }) });
      const responseText = await response.text();
      let result: { event?: { id: string; slug: string }; error?: string } = {};
      try { result = JSON.parse(responseText) as typeof result; } catch { result = { error: response.ok ? "The event response could not be read." : "The server could not publish the event." }; }
      if (!response.ok || !result.event) throw new Error(result.error || "Could not save event");
      setDatabaseEventId(result.event.id); setPublishedSlug(result.event.slug);
      if (status === "published") {
        const failedUploads: string[] = [];
        const persistedMedia = media.flatMap((item, position) => item.file ? [] : [{ id: item.id, position }]);
        if (persistedMedia.length) {
          const orderResponse = await fetch(`/api/events/${result.event.id}/media`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: persistedMedia }) });
          if (!orderResponse.ok) {
            const problem = await orderResponse.json().catch(() => ({})) as { error?: string };
            throw new Error(problem.error || "The gallery order could not be saved");
          }
        }
        const { createClient } = await import("@/lib/supabase/client");
        const storage = createClient();
        const { data: { user } } = await storage.auth.getUser();
        for (const [position, item] of media.entries()) {
          if (!item.file) continue;
          try {
            if (!user) throw new Error("Authentication required");
            const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
            const path = `${user.id}/${result.event.id}/${crypto.randomUUID()}-${safeName}`;
            const { error: uploadError } = await storage.storage.from("event-media").upload(path, item.file, { contentType: item.file.type, upsert: false });
            if (uploadError) throw uploadError;
            const register = await fetch(`/api/events/${result.event.id}/media`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, contentType: item.file.type, size: item.file.size, category: item.category, description: item.description, position }) });
            if (!register.ok) {
              const problem = await register.json().catch(() => ({})) as { error?: string };
              throw new Error(problem.error || "Media could not be saved");
            }
          } catch {
            failedUploads.push(item.description || item.file.name || `Media item ${position + 1}`);
          }
        }
        if (failedUploads.length) setPublishWarning(`${failedUploads.length} media item${failedUploads.length === 1 ? "" : "s"} could not be uploaded. The event is live and you can add them again from the dashboard.`);
        window.localStorage.removeItem(draftStorageKey); setPublished(true);
      }
      setSaveStatus("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save event";
      setSaveStatus(status === "draft" ? message : "");
      if (status === "published") setSaveError(message);
    }
  }
  useEffect(() => { saveEventRef.current = saveEvent; });
  async function addMedia(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    const accepted: File[] = [];
    const rejected: string[] = [];
    setMediaError("");
    for (const [index, file] of selected.entries()) {
      const video = file.type.startsWith("video/");
      const allowed = video ? ["video/mp4", "video/quicktime", "video/webm"].includes(file.type) : ["image/jpeg", "image/png", "image/webp", "image/heic"].includes(file.type);
      const maximum = video ? MAX_VIDEO_SOURCE_BYTES : 10 * 1024 * 1024;
      if (!allowed || file.size > maximum) { rejected.push(file.name); continue; }
      if (!video) { accepted.push(file); continue; }
      try {
        setMediaProcessing(`Optimizing ${index + 1} of ${selected.length} · 0%`);
        const optimized = await optimizeVideo(file, (progress) => setMediaProcessing(`Optimizing ${index + 1} of ${selected.length} · ${progress}%`));
        accepted.push(optimized);
      } catch (error) {
        rejected.push(`${file.name}: ${error instanceof Error ? error.message : "Video optimization failed."}`);
      }
    }
    setMediaProcessing("");
    setMediaError(rejected.length ? `${rejected.join(" · ")} Videos can be up to 500 MB and are optimized automatically. Photos can be up to 10 MB.` : "");
    const additions = accepted.map((file, index): MediaItem => ({ id: `${Date.now()}-${index}`, src: URL.createObjectURL(file), kind: file.type.startsWith("video/") ? "video" : "photo", description: "", category: "Atmosphere", file }));
    setMedia((current) => [...current, ...additions].slice(0, 10));
  }

  if (published) return <CreateSuccess slug={publishedSlug} warning={publishWarning} onAgain={() => { setPublished(false); setPublishWarning(""); setStarted(false); setDraftReady(false); }} />;

  if (!started) return <CreateEventWelcome onStart={beginNewEvent} />;

  return <div className="create-event-screen">
      <header className="create-event-header">{step === 1 ? <span className="create-event-header-spacer" aria-hidden="true" /> : <button type="button" aria-label="Previous step" onClick={previous}><DiscoverIcon name="chevron" /></button>}<h1>{databaseEventId ? "Edit Event" : "Create Event"}</h1></header>
    <CreateStepper step={step} />
    {step === 1 && <BasicStep category={category} setCategory={setCategory} targetAudience={targetAudience} setTargetAudience={setTargetAudience} title={title} setTitle={setTitle} description={description} setDescription={setDescription} />}
    {step === 2 && <DateStep kind={eventKind} setKind={setEventKind} value={dateInfo} onChange={setDateInfo} />}
    {step === 3 && <LocationStep value={locationInfo} onChange={setLocationInfo} />}
    {step === 4 && <MediaStep media={media} mediaError={mediaError} mediaProcessing={mediaProcessing} addMedia={addMedia} updateMedia={updateMedia} moveMedia={moveMedia} removeMedia={(id) => setMedia((current) => current.filter((item) => item.id !== id))} />}
    {step === 5 && <LineupStep items={lineup} setItems={setLineup} />}
    {step === 6 && <ExpectStep items={expectations} setItems={setExpectations} />}
    {step === 7 && <TicketStep kind={ticketKind} setKind={setTicketKind} tickets={tickets} addTicket={addTicket} setAddTicket={(value) => { setAddTicket(value); if (!value) setEditingTicketIndex(null); }} editTicket={editTicket} editing={editingTicketIndex !== null} ticketName={ticketName} setTicketName={setTicketName} ticketPrice={ticketPrice} setTicketPrice={setTicketPrice} ticketQuantity={ticketQuantity} setTicketQuantity={setTicketQuantity} saveTicket={saveTicket} liveDiscoveryEnabled={liveDiscoveryEnabled} setLiveDiscoveryEnabled={setLiveDiscoveryEnabled} ticketSalesDuringEvent={ticketSalesDuringEvent} setTicketSalesDuringEvent={setTicketSalesDuringEvent} />}
    {step === 8 && <AffiliateStep commission={affiliateCommission} setCommission={setAffiliateCommission} />}
    {step === 9 && <PublishStep title={title} description={description} locationKind={locationKind} ticketKind={ticketKind} tickets={tickets} media={media} lineup={lineup} expectations={expectations} affiliateCommission={affiliateCommission} edit={setStep} />}
    {!(step === 7 && addTicket) && <div className="create-event-footer">{step === 9 && saveError && <div className="create-event-publish-error" role="alert"><strong>{existingStatus === "published" ? "Changes could not be saved" : "Event could not be published"}</strong><span>{saveError}</span></div>}<button type="button" disabled={saveStatus === "Publishing…" || Boolean(mediaProcessing)} aria-busy={saveStatus === "Publishing…" || Boolean(mediaProcessing)} onClick={() => step === 9 ? void saveEvent("published") : next()}>{mediaProcessing ? "Optimizing video…" : step === 9 ? (saveStatus === "Publishing…" ? (existingStatus === "published" ? "Saving…" : saveStatus) : existingStatus === "published" ? "Save Changes" : "Publish Event") : "Continue"}<DiscoverIcon name="arrow" /></button></div>}
  </div>;
}

function CreateEventWelcome({ onStart }: { onStart: () => void }) {
  return <main className="create-event-welcome"><section><span className="create-event-welcome-symbol" aria-hidden="true">🎉</span><small>HOST WITH ATTND</small><h1>Ready to create<br />your event?</h1><p>Bring people together, sell tickets and manage everything from one place.</p><div><span><i aria-hidden="true">🎟️</i>Tickets</span><span><i aria-hidden="true">📝</i>Guestlist</span><span><i aria-hidden="true">👥</i>Team</span><span><i aria-hidden="true">📲</i>Check-in</span><span><i aria-hidden="true">💳</i>Payments</span><span><i aria-hidden="true">📣</i>Affiliates</span><span><i aria-hidden="true">📊</i>Analytics</span><span><i aria-hidden="true">🔔</i>Updates</span></div></section><button type="button" onClick={onStart}>Create an Event <DiscoverIcon name="arrow" /></button></main>;
}

function CreateStepper({ step }: { step: Step }) {
  return <ol className="create-event-stepper" aria-label={`Create event step ${step} of 9`}>{steps.map((label, index) => { const number = index + 1; return <li key={label} data-state={number < step ? "done" : number === step ? "active" : "upcoming"}><span aria-label={`${number}. ${label}`}>{number < step ? <DiscoverIcon name="check" /> : <b aria-hidden="true">{stepEmojis[index]}</b>}</span><small>{label}</small></li>; })}</ol>;
}

function StepHeading({ title, text }: { title: string; text: string }) { return <div className="create-event-heading"><h2>{title}</h2><p>{text}</p></div>; }

function BasicStep({ category, setCategory, targetAudience, setTargetAudience, title, setTitle, description, setDescription }: { category: string; setCategory: (value: string) => void; targetAudience: "all" | "women" | "men"; setTargetAudience: (value: "all" | "women" | "men") => void; title: string; setTitle: (value: string) => void; description: string; setDescription: (value: string) => void }) {
  const [showAllTypes, setShowAllTypes] = useState(false);
  const visibleTypes = showAllTypes ? categories : categories.slice(0, 5);
  return <main className="create-event-content"><StepHeading title="Basic Info" text="Let’s start with the essentials. You can always edit them later." /><label className="create-event-label">Event Type</label><div className="create-event-categories">{visibleTypes.map((label) => <button type="button" key={label} aria-pressed={category === label} onClick={() => setCategory(label)}>{label}</button>)}<button type="button" className="create-event-more-types" aria-expanded={showAllTypes} onClick={() => setShowAllTypes((visible) => !visible)}>{showAllTypes ? "Show less" : "More types"}</button></div><label className="create-event-label">Who is this event for?</label><div className="create-event-audience">{([['all','Everyone'],['women','Women'],['men','Men']] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={targetAudience === value} onClick={() => setTargetAudience(value)}>{label}</button>)}</div><Field label="Event Title" count={`${title.length}/100`}><input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} placeholder="Give your event a memorable name…" /></Field><Field label="Short Description" count={`${description.length}/300`}><textarea value={description} maxLength={300} onChange={(event) => setDescription(event.target.value)} placeholder="Tell people what your event is about…" /></Field></main>;
}

function MediaStep({ media, mediaError, mediaProcessing, addMedia, updateMedia, moveMedia, removeMedia }: { media: MediaItem[]; mediaError: string; mediaProcessing: string; addMedia: (files: FileList | null) => Promise<void>; updateMedia: (id: string, patch: Partial<MediaItem>) => void; moveMedia: (id: string, direction: -1 | 1) => void; removeMedia: (id: string) => void }) {
  return <main className="create-event-content"><StepHeading title="Event Gallery" text="Add photos and videos, then choose the exact order shown across the app." /><div className="create-gallery-summary"><strong>{media.length}/10 media items</strong><span>The first item appears first in Discover.</span></div>{mediaProcessing && <p className="create-gallery-processing" role="status"><i aria-hidden="true" />{mediaProcessing}<span>Keep Attnd open while your video is optimized.</span></p>}{mediaError && <p className="create-gallery-error" role="alert">{mediaError}</p>}<div className="create-gallery-items">{media.map((item, index) => <article key={item.id} className="create-gallery-item"><div className="create-gallery-preview">{item.kind === "video" ? <video src={item.src} muted playsInline controls /> : <Image src={item.src} alt={item.description || "Event gallery item"} fill unoptimized={item.src.startsWith("blob:")} sizes="150px" className="object-cover" />}{index === 0 && <b>First</b>}<span>{item.kind === "video" ? "Video" : "Photo"}</span><button type="button" aria-label="Remove media" onClick={() => removeMedia(item.id)}>×</button></div><div className="create-gallery-fields"><div className="create-gallery-order" aria-label={`Position ${index + 1} of ${media.length}`}><button type="button" disabled={index === 0} aria-label="Move media forward" onClick={() => moveMedia(item.id, -1)}>←</button><strong>{index + 1}</strong><button type="button" disabled={index === media.length - 1} aria-label="Move media back" onClick={() => moveMedia(item.id, 1)}>→</button></div><Field label="Gallery category"><select value={item.category === "Stage" ? "Venue" : item.category} onChange={(event) => updateMedia(item.id, { category: event.target.value as MediaCategory })}>{["Venue", "People", "Atmosphere", "Location", "UGC"].map((category) => <option key={category}>{category}</option>)}</select></Field><Field label="Description" count={`${item.description.length}/120`}><input value={item.description} maxLength={120} onChange={(event) => updateMedia(item.id, { description: event.target.value })} placeholder="Describe what people can see…" /></Field></div></article>)}</div><div className="create-gallery-add-options"><label className="create-gallery-add"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple disabled={Boolean(mediaProcessing)} onChange={(event) => { void addMedia(event.target.files); event.currentTarget.value = ""; }} /><strong>＋ Add Photos</strong><span>JPG, PNG, WEBP or HEIC · max 10 MB</span></label><label className="create-gallery-add"><input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" multiple disabled={Boolean(mediaProcessing)} onChange={(event) => { void addMedia(event.target.files); event.currentTarget.value = ""; }} /><strong>＋ Add Videos</strong><span>Up to 500 MB · optimized automatically</span></label></div><InfoCard title="Fast video playback" text="Large videos are resized and compressed before upload so they start quickly in Discover." /></main>;
}

function LineupStep({ items, setItems }: { items: LineupItem[]; setItems: React.Dispatch<React.SetStateAction<LineupItem[]>> }) {
  const update = (id: string, patch: Partial<LineupItem>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  return <main className="create-event-content"><StepHeading title="Schedule" text="Show attendees what happens at each time during your event." /><div className="create-lineup-list">{items.map((item, index) => <article key={item.id} className="create-lineup-row"><span>{index + 1}</span><Field label="Time"><input type="time" value={item.time} onChange={(event) => update(item.id, { time: event.target.value })} /></Field><Field label="What happens?"><input value={item.title} maxLength={100} onChange={(event) => update(item.id, { title: event.target.value })} placeholder="e.g. Doors open, DJ set, workshop…" /></Field><button type="button" aria-label={`Remove ${item.title || "schedule item"}`} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}>×</button></article>)}</div><button type="button" className="create-lineup-add" onClick={() => setItems((current) => [...current, { id: `${Date.now()}`, time: "20:00", title: "" }])}>＋ Add schedule item</button><InfoCard title="Keep guests informed" text="The schedule appears in the Schedule tab on the event detail page in this order." /></main>;
}

function ExpectStep({ items, setItems }: { items: string[]; setItems: React.Dispatch<React.SetStateAction<string[]>> }) {
  return <main className="create-event-content"><StepHeading title="What to Expect" text="Create a clear list of what guests can expect from the experience." /><div className="create-expect-list">{items.map((item, index) => <article key={`${index}-${item}`}><span><DiscoverIcon name="check" /></span><Field label={`Expectation ${index + 1}`}><input value={item} maxLength={120} onChange={(event) => setItems((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} placeholder="e.g. Guided session for all levels" /></Field><button type="button" aria-label={`Remove expectation ${index + 1}`} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></article>)}</div><button type="button" className="create-lineup-add" onClick={() => setItems((current) => [...current, ""])}>＋ Add expectation</button><InfoCard title="Set the right expectations" text="These points appear under What to Expect on the event detail page." /></main>;
}

function DateStep({ kind, setKind, value, onChange }: { kind: EventKind; setKind: (kind: EventKind) => void; value: DateInfo; onChange: (value: DateInfo) => void }) {
  const update = (patch: Partial<DateInfo>) => onChange({ ...value, ...patch });
  return <main className="create-event-content create-event-date-step"><StepHeading title="When is your event?" text="Set the date, time and repeat schedule for your event." /><div className="create-event-choice-grid create-event-kind-choice create-event-kind-plain"><Choice selected={kind === "single"} onClick={() => setKind("single")} icon="calendar" title="Single Event" text="One date" /><Choice selected={kind === "series"} onClick={() => setKind("series")} icon="arrow" title="Event Series" text="Multiple dates" /></div>{kind === "series" && <><Field label="Repeat"><select defaultValue="week"><option value="week">Every week</option><option value="month">Every month</option></select></Field><div className="create-event-days">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <button type="button" key={day} aria-pressed={day === "Tue" || day === "Thu"}>{day}</button>)}</div></>}<div className="create-event-date-rows"><Field label="Start Date"><input type="date" value={value.startDate} onChange={(event) => update({ startDate: event.target.value })} /></Field><Field label="End Date"><input type="date" value={value.endDate} onChange={(event) => update({ endDate: event.target.value })} /></Field></div><div className="create-event-time-rows"><Field label="Start Time"><input type="time" value={value.startTime} onChange={(event) => update({ startTime: event.target.value })} /></Field><Field label="End Time"><input type="time" value={value.endTime} onChange={(event) => update({ endTime: event.target.value })} /></Field></div>{kind === "series" && <section className="create-event-inline"><h3>End</h3><p>When does the series end?</p><label><input type="radio" name="end" defaultChecked />After a number of events <input type="number" defaultValue="10" min="1" /></label><label><input type="radio" name="end" />On a specific date</label></section>}<Field label="Timezone"><select value={value.timezone} onChange={(event) => update({ timezone: event.target.value })}><option value="Asia/Bangkok">(GMT+7) Bangkok</option><option value="Europe/Berlin">(GMT+2) Berlin</option></select></Field></main>;
}

function LocationStep({ value, onChange }: { value: LocationInfo; onChange: (value: LocationInfo) => void }) {
  const [editingLocation, setEditingLocation] = useState(false);
  const update = (patch: Partial<LocationInfo>) => onChange({ ...value, ...patch });
  const location = { lat: value.latitude, lon: value.longitude };
  return <main className="create-event-content"><StepHeading title="Where is your event?" text="Add the location so people can find your event." /><Field label="City"><input value={value.city} onChange={(event) => update({ city: event.target.value })} placeholder="Search for a city…" /></Field><CreateLocationMap location={location} editing={editingLocation} onChange={(point) => update({ latitude: point.lat, longitude: point.lon })} /><section className="create-event-box create-event-location-card"><DiscoverIcon name="pin" /><p><strong>{value.venueName || value.city || "Selected location"}</strong><span>{location.lat.toFixed(5)}, {location.lon.toFixed(5)}</span></p><button type="button" aria-pressed={editingLocation} onClick={() => setEditingLocation((current) => !current)}>{editingLocation ? "Save Location" : "Edit Location"}</button></section><Field label="Venue name"><input value={value.venueName} onChange={(event) => update({ venueName: event.target.value })} placeholder="e.g. Sunset Beach Club" /></Field><Field label="Address"><input value={value.address} onChange={(event) => update({ address: event.target.value })} placeholder="e.g. 123 Moo 6, Haad Rin" /></Field><Field label="Google Maps URL"><input value={value.googleMapsUrl} onChange={(event) => update({ googleMapsUrl: event.target.value })} type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://maps.google.com/…" /></Field><Field label="Additional info"><input value={value.locationNotes} onChange={(event) => update({ locationNotes: event.target.value })} placeholder="e.g. entrance, floor, room, parking" /></Field><ToggleRow title="Location Visibility" text="Show exact location" defaultChecked /></main>;
}

function CreateLocationMap({ location, editing, onChange }: { location: { lat: number; lon: number }; editing: boolean; onChange: (location: { lat: number; lon: number }) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const initialLocationRef = useRef(location);
  const editingRef = useRef(editing);
  const onChangeRef = useRef(onChange);
  useEffect(() => { editingRef.current = editing; }, [editing]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    void import("leaflet").then((L) => {
      if (cancelled) return;
      const initialLocation = initialLocationRef.current;
      const map = L.map(container, { zoomControl: true, attributionControl: true, minZoom: 8, maxZoom: 18 }).setView([initialLocation.lat, initialLocation.lon], 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
      const marker = L.marker([initialLocation.lat, initialLocation.lon], { draggable: editingRef.current, icon: L.divIcon({ className: "create-location-marker", html: "<span></span>", iconSize: [34, 42], iconAnchor: [17, 42] }) }).addTo(map);
      marker.on("dragend", () => { const point = marker.getLatLng(); onChangeRef.current({ lat: point.lat, lon: point.lng }); });
      mapRef.current = map;
      markerRef.current = marker;
      observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      observer.observe(container);
      window.setTimeout(() => map.invalidateSize({ pan: false }), 0);
    });
    return () => { cancelled = true; observer?.disconnect(); mapRef.current?.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (editing) marker.dragging?.enable();
    else marker.dragging?.disable();
  }, [editing]);
  useEffect(() => { markerRef.current?.setLatLng([location.lat, location.lon]); }, [location]);
  return <div className={`create-event-map create-event-live-map${editing ? " is-editing" : ""}`}><div ref={containerRef} aria-label="Interactive OpenStreetMap event location picker" /><span><DiscoverIcon name="pin" />{editing ? "Drag the pin to set the location" : "Haad Rin, Koh Phangan"}</span></div>;
}

function TicketStep({ kind, setKind, tickets, addTicket, setAddTicket, editTicket, editing, ticketName, setTicketName, ticketPrice, setTicketPrice, ticketQuantity, setTicketQuantity, saveTicket, liveDiscoveryEnabled, setLiveDiscoveryEnabled, ticketSalesDuringEvent, setTicketSalesDuringEvent }: { kind: TicketKind; setKind: (kind: TicketKind) => void; tickets: string[]; addTicket: boolean; setAddTicket: (value: boolean) => void; editTicket: (index: number) => void; editing: boolean; ticketName: string; setTicketName: (value: string) => void; ticketPrice: string; setTicketPrice: (value: string) => void; ticketQuantity: string; setTicketQuantity: (value: string) => void; saveTicket: () => void; liveDiscoveryEnabled: boolean; setLiveDiscoveryEnabled: (value: boolean) => void; ticketSalesDuringEvent: boolean; setTicketSalesDuringEvent: (value: boolean) => void }) {
  const [limitAttendees, setLimitAttendees] = useState(true);
  const [maximumAttendees, setMaximumAttendees] = useState("100");
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("10");
  const [discountLimit, setDiscountLimit] = useState("50");
  const [discountDeadline, setDiscountDeadline] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [salesPeriod, setSalesPeriod] = useState(false);
  const [salesEndDate, setSalesEndDate] = useState("");
  const [benefitsEnabled, setBenefitsEnabled] = useState(false);
  const [benefits, setBenefits] = useState([""]);
  useEffect(() => {
    if (!discountEnabled || !discountCode.trim()) return;
    window.localStorage.setItem("attnd:event-discount", JSON.stringify({ code: discountCode.trim(), type: discountType, value: Number(discountValue) || 0, limit: Number(discountLimit) || 0, deadline: discountDeadline }));
  }, [discountEnabled, discountType, discountValue, discountLimit, discountDeadline, discountCode]);
  if (addTicket) return <main className="create-event-content create-ticket-editor"><StepHeading title={editing ? "Edit Ticket Type" : "Add Ticket Type"} text={editing ? "Update every field for this ticket type." : "Configure your ticket details."} /><section className="create-event-box"><Field label="Ticket Name"><input value={ticketName} onChange={(event) => setTicketName(event.target.value)} placeholder="e.g. Early Bird" /></Field><Field label="Price"><input value={ticketPrice} onChange={(event) => setTicketPrice(event.target.value)} inputMode="decimal" placeholder="0.00" /></Field><Field label="Quantity Available"><input type="number" value={ticketQuantity} onChange={(event) => setTicketQuantity(event.target.value)} placeholder="e.g. 100" /></Field><Field label="Description (Optional)" count="0/200"><textarea placeholder="What’s included in this ticket?" /></Field></section><h3 className="create-event-label">Additional Options</h3><section className="create-event-box create-ticket-options"><ToggleRow title="Set sales period" text="Choose when this ticket goes off sale." checked={salesPeriod} onChange={setSalesPeriod} />{salesPeriod && <Field label="Sell tickets until"><input type="datetime-local" value={salesEndDate} onChange={(event) => setSalesEndDate(event.target.value)} /></Field>}<ToggleRow title="Limit to 1 per person" text="Each user can only buy one." defaultChecked /><ToggleRow title="Include special benefits" text="Add everything included with this ticket." checked={benefitsEnabled} onChange={setBenefitsEnabled} />{benefitsEnabled && <div className="create-ticket-benefits"><strong>Special benefits</strong>{benefits.map((benefit, index) => <label key={index}><input value={benefit} maxLength={100} onChange={(event) => setBenefits((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder="e.g. VIP area access" /><button type="button" aria-label={`Remove benefit ${index + 1}`} disabled={benefits.length === 1} onClick={() => setBenefits((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></label>)}<button type="button" onClick={() => setBenefits((current) => [...current, ""])}>＋ Add another benefit</button></div>}</section><button type="button" className="create-event-inline-primary create-event-ticket-save" onClick={saveTicket}>{editing ? "Save Changes" : "Save Ticket Type"}</button><button type="button" className="create-event-cancel" onClick={() => setAddTicket(false)}>Cancel</button></main>;
  return <main className="create-event-content"><StepHeading title="Set up tickets" text="Choose if your event is free or paid and configure your ticket options." /><div className="create-event-choice-grid create-ticket-kind-choice"><Choice selected={kind === "free"} onClick={() => setKind("free")} icon="ticket" title="Free Event" text="No charge for tickets" /><Choice selected={kind === "paid"} onClick={() => setKind("paid")} icon="ticket" title="Paid Event" text="Charge for tickets" /></div>{kind === "paid" && <><label className="create-event-label">Ticket Types</label><p className="create-event-help">Tap an existing ticket to edit all of its fields.</p><div className="create-event-ticket-list">{tickets.map((ticket, index) => { const [name, price, quantity] = ticket.split(" · "); return <button type="button" key={`${ticket}-${index}`} onClick={() => editTicket(index)}><span>⠿</span><p><strong>{name}</strong><small>{price}</small></p><em>{quantity}<small>Available</small></em><DiscoverIcon name="chevron" /></button>; })}<button type="button" onClick={() => setAddTicket(true)}>⊕ Add Ticket Type</button></div></>}<label className="create-event-label">Live Event Settings</label><section className="create-event-box create-ticket-options"><ToggleRow title="Show this event as Live" text="Display it in Discover and Explore while it is happening." checked={liveDiscoveryEnabled} onChange={setLiveDiscoveryEnabled} /><ToggleRow title="Sell tickets while the event is running" text="Keep checkout open after the event start time." checked={ticketSalesDuringEvent} onChange={setTicketSalesDuringEvent} /></section><label className="create-event-label">Additional Settings</label><section className="create-event-box create-ticket-options"><ToggleRow title="Set a maximum number of attendees" text="Applies across all ticket types" checked={limitAttendees} onChange={setLimitAttendees} />{limitAttendees && <Field label="Maximum attendees"><input type="number" min="1" inputMode="numeric" value={maximumAttendees} onChange={(event) => setMaximumAttendees(event.target.value)} placeholder="e.g. 100" /></Field>}<ToggleRow title="Allow waitlist" text="Let people join when tickets sell out" />{kind === "paid" && <><ToggleRow title="Do you want to give a discount?" text="Create a code guests can enter at checkout" checked={discountEnabled} onChange={setDiscountEnabled} />{discountEnabled && <div className="create-discount-settings"><strong>Discount type</strong><div className="create-discount-type"><button type="button" aria-pressed={discountType === "percentage"} onClick={() => setDiscountType("percentage")}>Percentage</button><button type="button" aria-pressed={discountType === "fixed"} onClick={() => setDiscountType("fixed")}>Fixed amount</button></div><Field label="Discount code"><input value={discountCode} onChange={(event) => setDiscountCode(event.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="e.g. SUMMER20" maxLength={24} autoCapitalize="characters" /></Field><Field label={discountType === "percentage" ? "Discount percentage" : "Fixed discount amount"}><div className="create-discount-value"><span>{discountType === "percentage" ? "%" : "$"}</span><input type="number" min="1" max={discountType === "percentage" ? "100" : undefined} inputMode="decimal" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} /></div></Field><Field label="Maximum redemptions"><input type="number" min="1" inputMode="numeric" value={discountLimit} onChange={(event) => setDiscountLimit(event.target.value)} placeholder="e.g. 50" /></Field><Field label="Redemption deadline"><input type="datetime-local" value={discountDeadline} onChange={(event) => setDiscountDeadline(event.target.value)} /></Field></div>}</>}</section></main>;
}

function AffiliateStep({ commission, setCommission }: { commission: number; setCommission: (value: number) => void }) {
  return <main className="create-event-content"><StepHeading title="Affiliate commission" text="Choose how much affiliates earn for every ticket sale they generate." /><section className="create-event-box create-affiliate-commission"><div><span>Commission per sale</span><strong>{commission}%</strong></div><input type="range" min="0" max="50" step="1" value={commission} onChange={(event) => setCommission(Number(event.target.value))} aria-label="Affiliate commission percentage" /><footer><span>0%</span><span>50%</span></footer><div className="create-affiliate-presets">{[0, 10, 15, 20, 25, 30, 40, 50].map((value) => <button type="button" key={value} aria-pressed={commission === value} onClick={() => setCommission(value)}>{value}%</button>)}</div><p><DiscoverIcon name="info" />Affiliates receive {commission}% of each ticket sale made through their personal affiliate link.</p></section></main>;
}

function PublishStep({ title, description, locationKind, ticketKind, tickets, media, lineup, expectations, affiliateCommission, edit }: { title: string; description: string; locationKind: LocationKind; ticketKind: TicketKind; tickets: string[]; media: MediaItem[]; lineup: LineupItem[]; expectations: string[]; affiliateCommission: number; edit: (step: Step) => void }) {
  const cards: [string, string, string, Step][] = [["Date & Time", "Tue, Oct 1, 2024", "5:30 PM – 7:30 PM (GMT+7)", 2], ["Location", locationKind === "venue" ? "Sunset Beach Club" : "Zoom", locationKind === "venue" ? "123 Moo 6, Haad Rin, Koh Phangan" : "Link shown after booking", 3], ["Gallery", `${media.length} media item${media.length === 1 ? "" : "s"}`, `${new Set(media.map((item) => item.category)).size} gallery categories`, 4], ["Schedule", `${lineup.length} program item${lineup.length === 1 ? "" : "s"}`, lineup[0] ? `${lineup[0].time} · ${lineup[0].title}` : "No schedule added", 5], ["What to Expect", `${expectations.length} expectation${expectations.length === 1 ? "" : "s"}`, expectations[0] || "No expectations added", 6], ["Tickets", `${ticketKind === "paid" ? tickets.length : 1} ticket type${tickets.length === 1 ? "" : "s"}`, ticketKind === "paid" ? "Paid event" : "Free event", 7], ["Affiliate Commission", `${affiliateCommission}% per referred sale`, affiliateCommission === 0 ? "Affiliate sales disabled" : "Active for all affiliate links", 8], ["Additional Settings", "Max attendees: No limit", "Waitlist: Enabled · Sales until event date", 7]];
  return <main className="create-event-content"><StepHeading title="Review & Publish" text="Check your event details before publishing." /><section className="create-event-review-card"><Image src="/events/gallery-sunset.jpg" alt="Event cover" width={60} height={60} /><p><strong>{title || "Untitled Event"}</strong><span>{description || "Add a short description."}</span></p><button type="button" onClick={() => edit(1)}>Edit</button></section>{cards.map(([heading, line1, line2, target]) => <section className="create-event-review-card" key={heading}><DiscoverIcon name={heading === "Date & Time" ? "calendar" : heading === "Location" ? "pin" : heading === "Tickets" ? "ticket" : "sliders"} /><p><strong>{heading}</strong><span>{line1}<br />{line2}</span></p><button type="button" onClick={() => edit(target)}>Edit</button></section>)}</main>;
}

function CreateSuccess({ slug, warning, onAgain }: { slug: string; warning?: string; onAgain: () => void }) {
  const [shareLabel, setShareLabel] = useState("Share Event");

  async function shareEvent() {
    const url = new URL(`/events/${slug}`, window.location.origin).toString();
    const data = { title: "Attnd Event", text: "Join me at this event on Attnd.", url };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareLabel("Link Copied");
      window.setTimeout(() => setShareLabel("Share Event"), 1800);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareLabel("Unable to Share");
      window.setTimeout(() => setShareLabel("Share Event"), 1800);
    }
  }

  return <div className="create-event-success"><div className="create-event-success-icon"><DiscoverIcon name="trophy" /></div><h1>Your event is live!</h1><p>Great work! 🎉<br />Your event has been published and is now visible<br />to your audience.</p>{warning && <p className="create-event-success-warning" role="status">{warning}</p>}<Link href={`/events/${slug}`}>View Event <DiscoverIcon name="arrow" /></Link><button type="button" onClick={onAgain}>Create Another Event</button><button type="button" onClick={shareEvent}><DiscoverIcon name="share" />{shareLabel}</button><InfoCard title="Pro Tip" text="Share your event on social media to reach more people and boost attendance." /></div>;
}

function Field({ label, count, children }: { label: string; count?: string; children: React.ReactNode }) { return <label className="create-event-field"><span>{label}{count && <small>{count}</small>}</span>{children}</label>; }
function Choice({ selected, onClick, icon, title, text }: { selected: boolean; onClick: () => void; icon: "calendar" | "arrow" | "ticket"; title: string; text: string }) { return <button type="button" className="create-event-choice" aria-pressed={selected} onClick={onClick}><i /><DiscoverIcon name={icon} /><p><strong>{title}</strong><span>{text}</span></p></button>; }
function ToggleRow({ title, text, defaultChecked = false, checked, onChange }: { title: string; text: string; defaultChecked?: boolean; checked?: boolean; onChange?: (checked: boolean) => void }) { return <label className="create-event-toggle"><p><strong>{title}</strong><span>{text}</span></p><input type="checkbox" defaultChecked={checked === undefined ? defaultChecked : undefined} checked={checked} onChange={(event) => onChange?.(event.target.checked)} /><i /></label>; }
function InfoCard({ title, text }: { title: string; text: string }) { return <aside className="create-event-info"><span>◉</span><p><strong>{title}</strong><small>{text}</small></p></aside>; }
