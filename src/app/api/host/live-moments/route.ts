import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/notify";

async function hostContext(eventRef?: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  const admin = createAdminClient();
  let event = null;
  if (eventRef) {
    const key = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(eventRef) ? "id" : "slug";
    const result = await admin.from("events").select("id,slug,title,starts_at,ends_at,live_discovery_enabled,live_notification_sent_at").eq(key, eventRef).eq("host_id", user.id).maybeSingle();
    event = result.data;
  }
  if (!event) {
    const result = await admin.from("events").select("id,slug,title,starts_at,ends_at,live_discovery_enabled,live_notification_sent_at").eq("host_id", user.id).eq("status", "published").order("starts_at", { ascending: false }).limit(1).maybeSingle();
    event = result.data;
  }
  if (!event) return { error: NextResponse.json({ error: "No published host event found" }, { status: 404 }) };
  return { admin, user, event };
}

export async function GET(request: Request) {
  const context = await hostContext(new URL(request.url).searchParams.get("event"));
  if ("error" in context) return context.error;
  const { admin, event } = context;
  const { data: moments, error } = await admin.from("event_live_moments").select("id,user_id,storage_path,public_url,kind,caption,status,created_at,profiles!event_live_moments_user_id_fkey(first_name,username,avatar_url)").eq("event_id", event.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const ids = (moments || []).map((moment) => moment.id);
  const [sharesResult, reportsResult, visitsResult, ordersResult] = ids.length ? await Promise.all([
    admin.from("event_live_moment_shares").select("moment_id").in("moment_id", ids),
    admin.from("event_live_moment_reports").select("id,moment_id,reason,status,created_at").in("moment_id", ids),
    admin.from("affiliate_link_visits").select("moment_id").in("moment_id", ids),
    admin.from("orders").select("affiliate_moment_id,total_minor,currency,payment_status").in("affiliate_moment_id", ids).in("payment_status", ["paid", "free"]),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const count = (rows: Array<Record<string, unknown>> | null | undefined, key: string, id: string) => (rows || []).filter((row) => row[key] === id).length;
  return NextResponse.json({ event, moments: (moments || []).map((moment) => ({ ...moment,
    stats: { shares: count(sharesResult.data, "moment_id", moment.id), reports: count(reportsResult.data, "moment_id", moment.id), clicks: count(visitsResult.data, "moment_id", moment.id), sales: count(ordersResult.data, "affiliate_moment_id", moment.id) },
    reports: (reportsResult.data || []).filter((report) => report.moment_id === moment.id),
  })) });
}

export async function PATCH(request: Request) {
  const body = await request.json() as { event?: string; momentId?: string; status?: "published" | "hidden"; reportStatus?: "reviewed" | "dismissed" };
  const context = await hostContext(body.event);
  if ("error" in context) return context.error;
  if (!body.momentId || !body.status) return NextResponse.json({ error: "Missing moderation action" }, { status: 400 });
  const { data, error } = await context.admin.from("event_live_moments").update({ status: body.status }).eq("id", body.momentId).eq("event_id", context.event.id).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message || "Moment not found" }, { status: 404 });
  if (body.reportStatus) await context.admin.from("event_live_moment_reports").update({ status: body.reportStatus }).eq("moment_id", body.momentId).eq("status", "open");
  return NextResponse.json({ updated: true });
}

export async function DELETE(request: Request) {
  const body = await request.json() as { event?: string; momentId?: string };
  const context = await hostContext(body.event);
  if ("error" in context) return context.error;
  const { data: moment } = await context.admin.from("event_live_moments").select("id,storage_path").eq("id", body.momentId || "").eq("event_id", context.event.id).maybeSingle();
  if (!moment) return NextResponse.json({ error: "Moment not found" }, { status: 404 });
  await context.admin.from("event_live_moments").delete().eq("id", moment.id);
  await context.admin.storage.from("event-media").remove([moment.storage_path]);
  return NextResponse.json({ deleted: true });
}

export async function POST(request: Request) {
  const body = await request.json() as { event?: string };
  const context = await hostContext(body.event);
  if ("error" in context) return context.error;
  const { admin, event } = context;
  const now = Date.now();
  if (!event.live_discovery_enabled || !event.starts_at || !event.ends_at || new Date(event.starts_at).getTime() > now || new Date(event.ends_at).getTime() < now) return NextResponse.json({ error: "This event is not live right now" }, { status: 409 });
  if (event.live_notification_sent_at) return NextResponse.json({ notified: false, alreadySent: true });
  const [{ data: tickets }, { data: invites }] = await Promise.all([
    admin.from("tickets").select("owner_id").eq("event_id", event.id).in("status", ["valid", "used"]),
    admin.from("event_invites").select("invitee_id").eq("event_id", event.id).not("invitee_id", "is", null),
  ]);
  const recipients = [...new Set([...(tickets || []).map((row) => row.owner_id), ...(invites || []).map((row) => row.invitee_id).filter(Boolean)])] as string[];
  await notifyUsers(recipients, { category: "Events", title: `${event.title} is live`, body: "See what’s happening now and share the moment with friends.", href: `/events/${event.slug}`, preference: "updates", metadata: { eventId: event.id, live: true } });
  await admin.from("events").update({ live_notification_sent_at: new Date().toISOString() }).eq("id", event.id);
  return NextResponse.json({ notified: true, recipients: recipients.length });
}
