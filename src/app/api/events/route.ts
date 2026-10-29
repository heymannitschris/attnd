import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type EventPayload = {
  id?: string; status?: "draft" | "published"; title?: string; description?: string; category?: string;
  audience?: "all" | "women" | "men"; eventKind?: "single" | "series";
  startDate?: string; endDate?: string; startTime?: string; endTime?: string; timezone?: string;
  locationKind?: "venue" | "online"; venueName?: string; address?: string; city?: string;
  latitude?: number; longitude?: number; googleMapsUrl?: string; onlineUrl?: string; locationNotes?: string;
  schedule?: Array<{ time: string; title: string }>; expectations?: string[]; affiliateCommission?: number;
  liveDiscoveryEnabled?: boolean; ticketSalesDuringEvent?: boolean;
  tickets?: Array<{ id?: string; name: string; description?: string; priceMinor: number; currency: string; quantity: number; benefits?: string[] }>;
};

const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55);
const toTimestamp = (date?: string, time?: string) => date ? new Date(`${date}T${time || "00:00"}:00+07:00`).toISOString() : null;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: event, error } = await supabase.from("events")
    .select("*, ticket_types(id, name, description, price_minor, currency, quantity, benefits, active), event_media(id, public_url, kind, category, description, position)")
    .eq("id", id).eq("host_id", user.id).single();
  if (error || !event) return NextResponse.json({ error: error?.message || "Event not found" }, { status: 404 });
  return NextResponse.json({ event });
}

export async function POST(request: Request) {
  const body = await request.json() as EventPayload;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in to create an event" }, { status: 401 });
  if (body.status === "published" && (!body.title?.trim() || !body.category)) return NextResponse.json({ error: "Title and event type are required" }, { status: 400 });
  if (body.status === "published" && (!body.startDate || !body.startTime || !body.endTime)) return NextResponse.json({ error: "Event date and times are required" }, { status: 400 });
  if (body.status === "published" && (!body.tickets?.some((ticket) => ticket.name.trim()))) return NextResponse.json({ error: "Add at least one ticket type" }, { status: 400 });
  if (body.status === "published" && body.locationKind !== "online" && (!body.venueName?.trim() || !body.city?.trim())) return NextResponse.json({ error: "Venue and city are required" }, { status: 400 });

  const baseSlug = slugify(body.title || "untitled-event") || "event";
  const values = {
    host_id: user.id,
    slug: `${baseSlug}-${(body.id || crypto.randomUUID()).slice(0, 8)}`,
    status: body.status || "draft",
    title: body.title?.trim() || "Untitled Event",
    description: body.description?.trim() || "",
    category: body.category || null,
    audience: body.audience || "all",
    event_kind: body.eventKind || "single",
    starts_at: toTimestamp(body.startDate, body.startTime),
    ends_at: toTimestamp(body.endDate || body.startDate, body.endTime),
    timezone: body.timezone || "Asia/Bangkok",
    location_kind: body.locationKind || "venue",
    venue_name: body.venueName || null,
    address: body.address || null,
    city: body.city || null,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    google_maps_url: body.googleMapsUrl || null,
    online_url: body.onlineUrl || null,
    location_notes: body.locationNotes || null,
    schedule: body.schedule || [],
    expectations: (body.expectations || []).filter(Boolean),
    affiliate_commission: Math.max(0, Math.min(50, Number(body.affiliateCommission) || 0)),
    live_discovery_enabled: Boolean(body.liveDiscoveryEnabled),
    ticket_sales_during_event: Boolean(body.ticketSalesDuringEvent),
    published_at: body.status === "published" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { status: requestedStatus, published_at: requestedPublishedAt, ...eventDetails } = values;
  const initialValues = body.status === "published"
    ? body.id ? eventDetails : { ...eventDetails, status: "draft", published_at: null }
    : { ...eventDetails, status: requestedStatus, published_at: requestedPublishedAt };
  const query = body.id
    ? supabase.from("events").update(initialValues).eq("id", body.id).eq("host_id", user.id).select("id, slug, status").single()
    : supabase.from("events").insert(initialValues).select("id, slug, status").single();
  const { data: event, error } = await query;
  if (error || !event) return NextResponse.json({ error: error?.message || "Could not save event" }, { status: 400 });

  if (body.tickets) {
    const { data: existing, error: existingError } = await supabase.from("ticket_types")
      .select("id,name,sold_count,reserved_count").eq("event_id", event.id);
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 400 });
    const remaining = [...(existing || [])];
    for (const ticket of body.tickets.filter((item) => item.name.trim())) {
      const matchIndex = remaining.findIndex((item) => item.id === ticket.id || item.name === ticket.name.trim());
      const match = matchIndex >= 0 ? remaining.splice(matchIndex, 1)[0] : null;
      const quantity = Math.max(1, Math.round(ticket.quantity));
      if (match && quantity < match.sold_count + match.reserved_count) {
        return NextResponse.json({ error: `${ticket.name} has more sold or reserved tickets than its new capacity` }, { status: 400 });
      }
      const values = {
        name: ticket.name.trim(), description: ticket.description || "",
        price_minor: Math.max(0, Math.round(ticket.priceMinor)), currency: ticket.currency.toLowerCase(),
        quantity, benefits: ticket.benefits || [], active: true,
      };
      const { error: ticketError } = match
        ? await supabase.from("ticket_types").update(values).eq("id", match.id).eq("event_id", event.id)
        : await supabase.from("ticket_types").insert({ ...values, event_id: event.id });
      if (ticketError) return NextResponse.json({ error: ticketError.message }, { status: 400 });
    }
    if (remaining.length) {
      const { error: inactiveError } = await supabase.from("ticket_types").update({ active: false }).eq("event_id", event.id).in("id", remaining.map((item) => item.id));
      if (inactiveError) return NextResponse.json({ error: inactiveError.message }, { status: 400 });
    }
  }
  if (body.status === "published") {
    const { data: publishedEvent, error: publishError } = await supabase.from("events")
      .update({ status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", event.id).eq("host_id", user.id).select("id, slug, status").single();
    if (publishError || !publishedEvent) return NextResponse.json({ error: publishError?.message || "Could not publish event" }, { status: 400 });
    return NextResponse.json({ event: publishedEvent });
  }
  return NextResponse.json({ event });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id,host_id,title").eq("id", id).maybeSingle();
  if (!event || event.host_id !== user.id) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const { count, error: orderError } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("event_id", id);
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (count) return NextResponse.json({ error: "Events with bookings cannot be deleted. Cancel or relist this event instead." }, { status: 409 });
  const { error } = await admin.from("events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deleted: true });
}
