import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const admin = createAdminClient();
  const { data: rows, error } = await admin.from("event_staff")
    .select("event_id,role,status,created_at,events(id,slug,title,cover_url,starts_at,ends_at,city,status)")
    .eq("user_id", user.id).eq("role", "check_in").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const eventId = new URL(request.url).searchParams.get("eventId");
  let team: unknown[] = [];
  if (eventId) {
    const { data: event } = await admin.from("events").select("host_id").eq("id", eventId).maybeSingle();
    if (event?.host_id === user.id) {
      const { data } = await admin.from("event_staff")
        .select("user_id,role,status,created_at,profiles!event_staff_user_id_fkey(first_name,username,avatar_url)")
        .eq("event_id", eventId).eq("role", "check_in").order("created_at");
      team = data || [];
    }
  }
  return NextResponse.json({ assignments: rows || [], team });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { eventId?: string; username?: string } | null;
  if (!body?.eventId || !body.username?.trim()) return NextResponse.json({ error: "Choose an event and username" }, { status: 400 });
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id,title,host_id").eq("id", body.eventId).maybeSingle();
  if (!event || event.host_id !== user.id) return NextResponse.json({ error: "Only the event host can invite check-in staff" }, { status: 403 });
  const username = body.username.trim().replace(/^@/, "").toLowerCase();
  const { data: person } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
  if (!person || person.id === user.id) return NextResponse.json({ error: "Check-in staff account not found" }, { status: 404 });
  const { error } = await admin.from("event_staff").upsert({
    event_id: event.id, user_id: person.id, invited_by: user.id, role: "check_in", status: "pending", responded_at: null,
  }, { onConflict: "event_id,user_id,role" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from("notifications").insert({
    user_id: person.id, category: "Events", title: "Check-in team invitation",
    body: `You were invited to check in guests at ${event.title}.`, href: "/dashboard?tab=check-in-team",
  });
  return NextResponse.json({ invited: true });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { eventId?: string; status?: "accepted" | "declined" } | null;
  if (!body?.eventId || !["accepted", "declined"].includes(body.status || "")) return NextResponse.json({ error: "Invalid response" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("event_staff").update({ status: body.status, responded_at: new Date().toISOString() })
    .eq("event_id", body.eventId).eq("user_id", user.id).eq("role", "check_in").eq("status", "pending").select("event_id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  return NextResponse.json({ updated: true });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { eventId?: string; userId?: string } | null;
  if (!body?.eventId || !body.userId) return NextResponse.json({ error: "Missing staff assignment" }, { status: 400 });
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("host_id").eq("id", body.eventId).maybeSingle();
  if (event?.host_id !== user.id) return NextResponse.json({ error: "Only the event host can remove check-in staff" }, { status: 403 });
  const { error } = await admin.from("event_staff").update({ status: "revoked", responded_at: new Date().toISOString() })
    .eq("event_id", body.eventId).eq("user_id", body.userId).eq("role", "check_in");
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ revoked: true });
}
