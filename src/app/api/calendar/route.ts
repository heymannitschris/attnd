import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function validDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calendarDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(value = "") {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventRef = url.searchParams.get("eventRef")?.trim() || "event";
  const column = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(eventRef) ? "id" : "slug";
  const { data: event } = await createAdminClient().from("events")
    .select("id,slug,title,description,starts_at,ends_at,venue_name,address,city")
    .eq(column, eventRef)
    .eq("status", "published")
    .maybeSingle();

  const title = event?.title || url.searchParams.get("title") || "Attnd Event";
  const start = validDate(event?.starts_at || url.searchParams.get("start"));
  const end = validDate(event?.ends_at || url.searchParams.get("end")) || (start ? new Date(start.getTime() + 2 * 60 * 60 * 1000) : null);
  const location = event ? [event.venue_name, event.address, event.city].filter(Boolean).join(", ") : url.searchParams.get("location") || "";
  const eventUrl = `https://www.attnd.space/events/${event?.slug || eventRef}`;
  const description = [event?.description, eventUrl].filter(Boolean).join("\n\n");
  const calendar = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Attnd//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${escapeText(event?.id || eventRef)}@attnd.space`, `DTSTAMP:${calendarDate(new Date())}`, `SUMMARY:${escapeText(title)}`,
    ...(start ? [`DTSTART:${calendarDate(start)}`] : []), ...(end ? [`DTEND:${calendarDate(end)}`] : []),
    ...(location ? [`LOCATION:${escapeText(location)}`] : []), `DESCRIPTION:${escapeText(description)}`, `URL:${eventUrl}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const filename = `${(event?.slug || eventRef).replace(/[^a-z0-9-_]/gi, "-")}.ics`;
  return new Response(calendar, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `${url.searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename="${filename}"`, "Cache-Control": "private, max-age=60" } });
}
