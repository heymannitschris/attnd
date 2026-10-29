import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, sendEmail } from "@/lib/email";
import { notifyUsers } from "@/lib/notify";

type EventRow = { id: string; slug: string; title: string; starts_at: string; timezone: string; venue_name: string | null; city: string | null };
type SaveRow = { user_id: string; event_id: string };
type DeliveryRow = { id: string; push_sent: boolean; email_sent: boolean };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const now = new Date();
  const latest = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const { data: events, error: eventsError } = await admin.from("events")
    .select("id,slug,title,starts_at,timezone,venue_name,city")
    .eq("status", "published").gt("starts_at", now.toISOString()).lte("starts_at", latest.toISOString());
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });
  const dueEvents = (events || []) as EventRow[];
  if (!dueEvents.length) return NextResponse.json({ checked: 0, delivered: 0 });
  const { data: saves, error: savesError } = await admin.from("event_saves").select("user_id,event_id").in("event_id", dueEvents.map((event) => event.id));
  if (savesError) return NextResponse.json({ error: savesError.message }, { status: 500 });
  let delivered = 0;
  let failed = 0;
  for (const saved of (saves || []) as SaveRow[]) {
    const event = dueEvents.find((item) => item.id === saved.event_id);
    if (!event) continue;
    const hours = (new Date(event.starts_at).getTime() - now.getTime()) / 3_600_000;
    const kind = hours <= 3 ? "3h" : "24h";
    const { data: profile } = await admin.from("profiles").select("notification_preferences").eq("id", saved.user_id).maybeSingle();
    if ((profile?.notification_preferences as Record<string, boolean> | null)?.reminders === false) continue;
    let { data: delivery } = await admin.from("event_reminder_deliveries").select("id,push_sent,email_sent")
      .eq("user_id", saved.user_id).eq("event_id", event.id).eq("reminder_kind", kind).maybeSingle() as { data: DeliveryRow | null };
    if (!delivery) {
      const inserted = await admin.from("event_reminder_deliveries").insert({ user_id: saved.user_id, event_id: event.id, reminder_kind: kind })
        .select("id,push_sent,email_sent").maybeSingle();
      delivery = inserted.data as DeliveryRow | null;
      if (!delivery) {
        const existing = await admin.from("event_reminder_deliveries").select("id,push_sent,email_sent").eq("user_id", saved.user_id).eq("event_id", event.id).eq("reminder_kind", kind).maybeSingle();
        delivery = existing.data as DeliveryRow | null;
      }
    }
    if (!delivery || (delivery.push_sent && delivery.email_sent)) continue;
    const when = kind === "3h" ? "in about 3 hours" : "tomorrow";
    const href = `/events/${event.slug}`;
    if (!delivery.push_sent) {
      await notifyUsers([saved.user_id], { category: "Events", title: `${event.title} starts ${when}`, body: `${event.venue_name || event.city || "Your saved event"} is coming up. Open Attnd for the details.`, href, preference: "reminders", metadata: { eventId: event.id, reminder: kind } });
      await admin.from("event_reminder_deliveries").update({ push_sent: true }).eq("id", delivery.id);
      delivery.push_sent = true;
    }
    if (!delivery.email_sent) {
      const { data: authUser } = await admin.auth.admin.getUserById(saved.user_id);
      if (authUser.user?.email) {
        const starts = new Intl.DateTimeFormat("en", { dateStyle: "full", timeStyle: "short", timeZone: event.timezone || "UTC" }).format(new Date(event.starts_at));
        const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.attnd.space";
        const result = await sendEmail({ to: authUser.user.email, subject: `${event.title} starts ${when}`, html: `<h1>${escapeHtml(event.title)} starts ${escapeHtml(when)}</h1><p>${escapeHtml(starts)}</p><p>${escapeHtml([event.venue_name, event.city].filter(Boolean).join(", ") || "Open Attnd for the event location.")}</p><p><a href="${origin}${href}">View saved event</a></p>` });
        await admin.from("event_reminder_deliveries").update(result.sent ? { email_sent: true, email_error: null } : { email_error: result.reason.slice(0, 300) }).eq("id", delivery.id);
        delivery.email_sent = result.sent;
        if (!result.sent) failed += 1;
      } else {
        await admin.from("event_reminder_deliveries").update({ email_error: "No account email" }).eq("id", delivery.id);
      }
    }
    if (delivery.push_sent && delivery.email_sent) {
      await admin.from("event_reminder_deliveries").update({ completed_at: new Date().toISOString() }).eq("id", delivery.id);
      delivered += 1;
    }
  }
  return NextResponse.json({ checked: (saves || []).length, delivered, failed });
}
