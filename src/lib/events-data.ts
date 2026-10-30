import { mockEventDetails } from "@/lib/mock-event-details";
import { mockEvents } from "@/lib/mock-events";
import { mockTicketTiers } from "@/lib/mock-tickets";
import type { DiscoveryEvent, EventDetails } from "@/types/event";
import type { TicketTier } from "@/types/ticket";
import type { ExploreEvent } from "@/types/explore";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { cache } from "react";
import { eventTimeZone } from "@/lib/event-time";
import { unstable_cache } from "next/cache";

type EventRow = {
  id: string; slug: string; title: string; description: string; category: string | null;
  audience: "all" | "women" | "men"; starts_at: string | null; ends_at: string | null; timezone?: string | null;
  live_discovery_enabled?: boolean; ticket_sales_during_event?: boolean; unlisted?: boolean | null;
  venue_name: string | null; address: string | null; city: string | null; cover_url: string | null;
  latitude?: number | null; longitude?: number | null;
  expectations: unknown; schedule: unknown; location_kind: "venue" | "online";
  profiles?: { id: string; first_name: string | null; avatar_url: string | null } | null;
  event_media?: Array<{ public_url: string; kind: "photo" | "video"; category: string; description: string; position: number }>;
  ticket_types?: Array<{ id: string; name: string; description: string; price_minor: number; currency: string; quantity: number; sold_count: number; reserved_count?: number; active: boolean }>;
};

function formatDate(value: string | null, timezone?: string | null) {
  if (!value) return "Date to be announced";
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric", timeZone: eventTimeZone(timezone) }).format(new Date(value));
}

function formatTime(value: string | null, timezone?: string | null) {
  if (!value) return "Time to be announced";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: eventTimeZone(timezone) }).format(new Date(value));
}

function mapRow(row: EventRow): { event: DiscoveryEvent; details: EventDetails; tiers: TicketTier[]; databaseId: string } {
  const tiers = (row.ticket_types ?? []).filter((tier) => tier.active).map((tier): TicketTier => ({
    id: tier.id,
    name: tier.name,
    description: tier.description,
    price: tier.price_minor / 100,
    availability: tier.sold_count + (tier.reserved_count || 0) >= tier.quantity ? "sold-out" : tier.quantity - tier.sold_count - (tier.reserved_count || 0) <= 10 ? "limited" : "available",
  }));
  const lowest = tiers.filter((tier) => tier.availability !== "sold-out").sort((a, b) => a.price - b.price)[0];
  const photos = (row.event_media ?? []).filter((media) => media.kind === "photo").sort((a, b) => a.position - b.position);
  const media = (row.event_media ?? []).sort((a, b) => a.position - b.position).map((item) => ({ src: item.public_url, alt: item.description || row.title, kind: item.kind, category: (item.category || "Atmosphere") as "Venue" | "Stage" | "People" | "Atmosphere" | "Location" | "UGC", description: item.description || "" }));
  const fallbackImage = row.cover_url || photos[0]?.public_url || "/placeholders/black.svg";
  const event: DiscoveryEvent = {
    id: row.slug,
    title: row.title,
    date: formatDate(row.starts_at, row.timezone),
    time: formatTime(row.starts_at, row.timezone),
    location: [row.venue_name, row.city].filter(Boolean).join(", ") || (row.location_kind === "online" ? "Online" : row.address || "Location to be announced"),
    distance: row.address || "",
    price: !lowest || lowest.price === 0 ? "Free" : `From ${new Intl.NumberFormat("en-US", { style: "currency", currency: row.ticket_types?.[0]?.currency?.toUpperCase() || "THB" }).format(lowest.price)}`,
    attendeeCount: (row.ticket_types ?? []).reduce((total, tier) => total + tier.sold_count, 0),
    tags: [row.category || "Community"],
    image: fallbackImage,
    imageAlt: row.title,
    badge: row.category || "EVENT",
    audience: row.audience,
    startsAt: row.starts_at || undefined,
    endsAt: row.ends_at || undefined,
    liveDiscoveryEnabled: Boolean(row.live_discovery_enabled),
    ticketSalesDuringEvent: Boolean(row.ticket_sales_during_event),
    latitude: row.latitude == null ? undefined : Number(row.latitude),
    longitude: row.longitude == null ? undefined : Number(row.longitude),
  };
  const details: EventDetails = {
    eventId: row.slug,
    description: row.description,
    moreDescription: "",
    endTime: formatTime(row.ends_at, row.timezone),
    highlights: (Array.isArray(row.expectations) ? row.expectations : []).slice(0, 4).map((label, index) => ({ label: String(label), icon: (["leaf", "users", "music", "flame"] as const)[index % 4] })),
    host: { id: row.profiles?.id || row.id, name: row.profiles?.first_name || "Attnd Host", portrait: 0, avatarUrl: row.profiles?.avatar_url || undefined, eventCount: 1, rating: "New", verified: false },
    attendees: [],
    photos: photos.length ? photos.map((media) => ({ src: media.public_url, alt: media.description || row.title, title: media.description || row.title, caption: media.description, category: (media.category || "Atmosphere") as "Stage" | "People" | "Atmosphere" | "Location", likes: 0 })) : [{ src: fallbackImage, alt: row.title, title: row.title, caption: row.description, category: "Atmosphere" as const, likes: 0 }],
    media: media.length ? media : [{ src: fallbackImage, alt: row.title, kind: "photo" as const }],
    admission: tiers.some((tier) => tier.price > 0) ? "tickets" : "rsvp",
    schedule: Array.isArray(row.schedule) ? (row.schedule as Array<{ time: string; title: string }>).filter((item) => item?.time && item?.title) : [],
    expectations: Array.isArray(row.expectations) ? row.expectations.map(String) : [],
    location: row.latitude != null && row.longitude != null ? { lat: Number(row.latitude), lon: Number(row.longitude), address: row.address || [row.venue_name, row.city].filter(Boolean).join(", ") } : undefined,
  };
  return { event, details, tiers, databaseId: row.id };
}

async function loadRealAttendees(eventId: string) {
  const admin = createAdminClient();
  const [{ data: tickets, error: ticketError }, { data: guestlist, error: guestlistError }] = await Promise.all([
    admin.from("tickets").select("owner_id").eq("event_id", eventId).in("status", ["valid", "used"]),
    admin.from("event_guestlist_entries").select("user_id,plus_ones").eq("event_id", eventId).neq("status", "cancelled"),
  ]);
  if (ticketError) throw ticketError;
  if (guestlistError) throw guestlistError;
  const ticketOwners = new Set((tickets || []).map((ticket) => ticket.owner_id));
  const profileIds = [...new Set([...ticketOwners, ...(guestlist || []).map((entry) => entry.user_id).filter((id): id is string => Boolean(id))])];
  const { data: profiles, error: profileError } = profileIds.length
    ? await admin.from("profiles").select("id,first_name,username,avatar_url,notification_preferences").in("id", profileIds)
    : { data: [], error: null };
  if (profileError) throw profileError;
  return {
    count: (tickets?.length || 0) + (guestlist || []).reduce((sum, entry) => sum + (entry.user_id && ticketOwners.has(entry.user_id) ? 0 : 1 + (entry.plus_ones || 0)), 0),
    people: (profiles || []).filter((profile) => Boolean((profile.notification_preferences as Record<string, unknown> | null)?.public_attendance)).map((profile, index) => ({
      id: profile.id,
      name: profile.first_name || profile.username || "Attnd member",
      portrait: index % 4,
      avatarUrl: profile.avatar_url || undefined,
    })),
  };
}

async function loadEventBundle(id: string) {
  if (hasSupabaseConfig) {
    const supabase = createAdminClient();
    const selection = "*, profiles!events_host_id_fkey(id, first_name, avatar_url), event_media(public_url, kind, category, description, position), ticket_types(id, name, description, price_minor, currency, quantity, sold_count, reserved_count, active)";
    let { data, error } = await supabase.from("events").select(selection).eq("slug", id).maybeSingle();
    if (error) throw error;
    if (!data && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) {
      ({ data, error } = await supabase.from("events").select(selection).eq("id", id).maybeSingle());
      if (error) throw error;
    }
    if (data) {
      const bundle = mapRow(data as unknown as EventRow);
      const attendees = await loadRealAttendees(bundle.databaseId);
      bundle.event.attendeeCount = attendees.count;
      bundle.details.attendees = attendees.people;
      return bundle;
    }
    return null;
  }
  const event = mockEvents.find((item) => item.id === id);
  const details = mockEventDetails.find((item) => item.eventId === id);
  if (!event || !details) return null;
  const tiers = details.admission === "rsvp"
    ? [{ id: `${id}-free`, name: "Free Admission", description: "Reserve your spot", price: 0, availability: "available" as const }]
    : [...mockTicketTiers];
  return { event, details, tiers, databaseId: id };
}

export const getEventBundle = cache(unstable_cache(loadEventBundle, ["event-bundle-v1"], { revalidate: 30, tags: ["events"] }));

const TEST_EVENT_TITLE = /(^|[\s[(])(test|testing)([\s\])—–:-]|$)/i;

/** Feed rule: hide events that already ended and internal test events. */
export function isFeedVisibleEvent(row: Pick<EventRow, "title" | "starts_at" | "ends_at"> & { unlisted?: boolean | null }, now = Date.now()) {
  if (row.unlisted) return false;
  if (TEST_EVENT_TITLE.test(row.title || "")) return false;
  const end = row.ends_at || row.starts_at;
  if (!end) return true;
  const endMs = new Date(end).getTime();
  // Events without an explicit end stay visible for 6 hours after their start.
  return Number.isNaN(endMs) || (row.ends_at ? endMs : endMs + 6 * 60 * 60 * 1000) >= now;
}

async function loadPublishedExploreEvents(): Promise<ExploreEvent[]> {
  if (hasSupabaseConfig) {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("events")
      .select("*, event_media(public_url, kind, category, description, position), ticket_types(id, name, description, price_minor, currency, quantity, sold_count, reserved_count, active)")
      .eq("status", "published").not("latitude", "is", null).not("longitude", "is", null).order("starts_at");
    if (error) throw error;
    if (data) return (data as unknown as EventRow[]).filter((row) => isFeedVisibleEvent(row)).map((row, index) => {
      const mapped = mapRow(row).event;
      const lowestPrice = (row.ticket_types ?? []).filter((tier) => tier.active).reduce((lowest, tier) => Math.min(lowest, tier.price_minor), Number.POSITIVE_INFINITY);
      return {
        id: row.id,
        eventId: row.slug,
        title: row.title,
        venue: row.venue_name || row.city || "Event location",
        distance: "",
        dateLabel: formatDate(row.starts_at, row.timezone),
        time: formatTime(row.starts_at, row.timezone),
        attendeeCount: (row.ticket_types ?? []).reduce((total, tier) => total + tier.sold_count, 0),
        image: mapped.image,
        imageAlt: mapped.imageAlt,
        media: (row.event_media ?? []).sort((a, b) => a.position - b.position).map((item) => ({ src: item.public_url, alt: item.description || row.title, kind: item.kind })),
        category: row.category || "Community",
        audience: row.audience,
        free: lowestPrice === 0,
        price: lowestPrice === 0 || !Number.isFinite(lowestPrice) ? "Free" : `From ${new Intl.NumberFormat("en-US", { style: "currency", currency: row.ticket_types?.find((tier) => tier.active)?.currency?.toUpperCase() || "THB" }).format(lowestPrice / 100)}`,
        startsAt: row.starts_at || undefined,
        endsAt: row.ends_at || undefined,
        liveDiscoveryEnabled: Boolean(row.live_discovery_enabled),
        location: { lat: Number(row.latitude), lon: Number(row.longitude) },
        marker: { x: 30 + (index * 17) % 50, y: 28 + (index * 13) % 45, color: "#ffffff" },
      };
    });
    return [];
  }
  const { mockExploreEvents } = await import("@/lib/mock-explore");
  return [...mockExploreEvents];
}

export const getPublishedExploreEvents = unstable_cache(loadPublishedExploreEvents, ["published-explore-events-v1"], { revalidate: 30, tags: ["events"] });

async function loadPublishedEventBundles() {
  if (hasSupabaseConfig) {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("events").select("*, profiles!events_host_id_fkey(id, first_name, avatar_url), event_media(public_url, kind, category, description, position), ticket_types(id, name, description, price_minor, currency, quantity, sold_count, reserved_count, active)").eq("status", "published").order("starts_at");
    if (error) throw error;
    if (data) return (data as unknown as EventRow[]).filter((row) => isFeedVisibleEvent(row)).map((row) => mapRow(row));
    return [];
  }
  return mockEvents.flatMap((event) => {
    const details = mockEventDetails.find((item) => item.eventId === event.id);
    return details ? [{ event, details, tiers: [...mockTicketTiers], databaseId: event.id }] : [];
  });
}

export const getPublishedEventBundles = unstable_cache(loadPublishedEventBundles, ["published-event-bundles-v1"], { revalidate: 30, tags: ["events"] });

export async function getPublishedEvents() {
  return (await getPublishedEventBundles()).map((bundle) => bundle.event);
}
