import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { inviteEmail } from "@/lib/emails/templates";
import { notifyUsers } from "@/lib/notify";
import { getAppUrl } from "@/lib/stripe";

async function resolveEvent(admin: ReturnType<typeof createAdminClient>, value: string) {
  const query = admin.from("events").select("id, slug, title, starts_at, ends_at, timezone, venue_name, address, city, latitude, longitude, cover_url").eq("status", "published");
  return (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? query.eq("id", value) : query.eq("slug", value)).maybeSingle();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json() as { eventId?: string; recipientIds?: string[]; emails?: string[]; message?: string };
  if (!body.eventId) return NextResponse.json({ error: "Event is required" }, { status: 400 });
  const admin = createAdminClient();
  const { data: event } = await resolveEvent(admin, body.eventId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const requestedRecipientIds = [...new Set((body.recipientIds || []).filter((id) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) && id !== user.id))];
  const { data: recipientProfiles } = requestedRecipientIds.length ? await admin.from("profiles").select("id,notification_preferences").in("id", requestedRecipientIds) : { data: [] };
  const recipientIds = (recipientProfiles || []).filter((profile) => ((profile.notification_preferences || {}) as Record<string, unknown>).allow_event_invites !== false).map((profile) => profile.id);
  const skippedRecipients = requestedRecipientIds.length - recipientIds.length;
  const emails = [...new Set((body.emails || []).map((email) => email.trim().toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))];
  if (!recipientIds.length && !emails.length) return NextResponse.json({ error: requestedRecipientIds.length ? "These members do not accept event invitations." : "Choose at least one recipient" }, { status: requestedRecipientIds.length ? 409 : 400 });
  const message = String(body.message || "").slice(0, 300);
  const rows = [
    ...recipientIds.map((inviteeId) => ({ event_id: event.id, inviter_id: user.id, invitee_id: inviteeId, message, affiliate_user_id: user.id })),
    ...emails.map((email) => ({ event_id: event.id, inviter_id: user.id, invitee_email: email, message, affiliate_user_id: user.id, email_status: "queued" })),
  ];
  const { data: invites, error } = await admin.from("event_invites").upsert(rows, { onConflict: "event_id,inviter_id,invitee_id", ignoreDuplicates: false }).select("id, invitee_id, invitee_email");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const href = `/events/${event.slug}?affiliate_id=${user.id}`;
  await notifyUsers(recipientIds, { category: "Events", title: `You were invited to ${event.title}`, body: message || "Open the invitation to see the event.", href, metadata: { event_id: event.id, inviter_id: user.id } });
  const inviteUrl = new URL(href, getAppUrl(request)).toString();
  const deliveries = await Promise.all(emails.map(async (email) => ({ email, result: await (async () => { const mail = inviteEmail({ event, message, inviteUrl }); return sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text }); })() })));
  for (const delivery of deliveries) {
    await admin.from("event_invites").update({ email_status: delivery.result.sent ? "sent" : "failed", email_provider_id: delivery.result.sent ? delivery.result.id : null }).eq("inviter_id", user.id).eq("event_id", event.id).eq("invitee_email", delivery.email);
  }
  const failedEmails = deliveries.filter((delivery) => !delivery.result.sent).map((delivery) => delivery.email);
  return NextResponse.json({ sent: invites?.length || 0, skippedRecipients, failedEmails });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Event is required" }, { status: 400 });
  const admin = createAdminClient();
  const { data: event } = await resolveEvent(admin, eventId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const { data, error } = await supabase.from("event_invites").select("id,status,message,created_at,reminder_sent_at,invitee_email,invitee_id,profiles!event_invites_invitee_id_fkey(first_name,username,avatar_url)").eq("event_id", event.id).eq("inviter_id", user.id).order("created_at", { ascending: false });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ invites: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { eventId } = await request.json() as { eventId?: string };
  if (!eventId) return NextResponse.json({ error: "Event is required" }, { status: 400 });
  const admin = createAdminClient();
  const { data: event } = await resolveEvent(admin, eventId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const { data: pending } = await admin.from("event_invites").select("id,invitee_id,invitee_email").eq("event_id", event.id).eq("inviter_id", user.id).in("status", ["sent", "seen"]);
  const ids = (pending || []).flatMap((invite) => invite.invitee_id ? [invite.invitee_id] : []);
  await notifyUsers(ids, { category: "Events", title: `Reminder: ${event.title}`, body: "Your event invitation is waiting.", href: `/events/${event.slug}?affiliate_id=${user.id}` });
  await admin.from("event_invites").update({ reminder_sent_at: new Date().toISOString() }).eq("event_id", event.id).eq("inviter_id", user.id).in("status", ["sent", "seen"]);
  return NextResponse.json({ reminded: pending?.length || 0 });
}
