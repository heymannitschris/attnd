import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const admin = createAdminClient();
  const { data: rows, error } = await admin.from("event_cohosts").select("event_id,user_id,status,revenue_share_percent,created_at,events(id,slug,title,cover_url,starts_at,status,host_id)").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const eventIds = (rows || []).filter((row) => row.status === "accepted").map((row) => row.event_id);
  const { data: allocations } = eventIds.length ? await admin.from("revenue_allocations").select("event_id,amount_minor,currency,status").eq("user_id", user.id).eq("role", "cohost").in("event_id", eventIds) : { data: [] };
  const cohosting = (rows || []).map((row) => {
    const event = row.events as unknown as { id: string; slug: string; title: string; cover_url: string | null; starts_at: string | null; status: string; host_id: string } | null;
    const eventAllocations = (allocations || []).filter((allocation) => allocation.event_id === row.event_id && allocation.status === "earned");
    return { eventId: row.event_id, event, status: row.status, sharePercent: row.revenue_share_percent, earnedMinor: eventAllocations.reduce((sum, allocation) => sum + allocation.amount_minor, 0), currency: eventAllocations[0]?.currency || "thb" };
  });
  const eventId = new URL(request.url).searchParams.get("eventId");
  let team: unknown[] = [];
  if (eventId) {
    const { data: event } = await admin.from("events").select("host_id").eq("id", eventId).maybeSingle();
    if (event?.host_id === user.id) {
      const { data } = await admin.from("event_cohosts").select("user_id,status,revenue_share_percent,profiles!event_cohosts_user_id_fkey(first_name,username,avatar_url)").eq("event_id", eventId);
      team = data || [];
    }
  }
  return NextResponse.json({ cohosting, team });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { eventId?: string; username?: string; sharePercent?: number } | null;
  const share = Number(body?.sharePercent);
  if (!body?.eventId || !body.username || !Number.isInteger(share) || share < 0 || share > 100) return NextResponse.json({ error: "Choose an event, username, and a share from 0 to 100%" }, { status: 400 });
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id,title,host_id").eq("id", body.eventId).maybeSingle();
  if (!event || event.host_id !== user.id) return NextResponse.json({ error: "Only the event host can invite co-hosts" }, { status: 403 });
  const username = body.username.trim().replace(/^@/, "").toLowerCase();
  const { data: person } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
  if (!person || person.id === user.id) return NextResponse.json({ error: "Co-host account not found" }, { status: 404 });
  const [{ data: existing }, { data: teamShares }] = await Promise.all([
    admin.from("event_cohosts").select("user_id,revenue_share_percent").eq("event_id", event.id).neq("status", "declined"),
    admin.from("event_team_members").select("compensation_percent").eq("event_id", event.id).eq("compensation_type", "percentage").in("status", ["pending", "accepted"]),
  ]);
  const allocated = (existing || []).filter((row) => row.user_id !== person.id).reduce((sum, row) => sum + row.revenue_share_percent, 0)
    + (teamShares || []).reduce((sum, row) => sum + Number(row.compensation_percent || 0), 0);
  if (allocated + share > 100) return NextResponse.json({ error: "Co-host shares exceed 100%" }, { status: 400 });
  const { error } = await admin.from("event_cohosts").upsert({ event_id: event.id, user_id: person.id, invited_by: user.id, revenue_share_percent: share, status: "pending", responded_at: null }, { onConflict: "event_id,user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from("notifications").insert({ user_id: person.id, category: "Events", title: "Co-host invitation", body: `You were invited to co-host ${event.title}.`, href: "/dashboard?tab=co-hosting" });
  return NextResponse.json({ invited: true });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { eventId?: string; status?: "accepted" | "declined" } | null;
  if (!body?.eventId || !["accepted", "declined"].includes(body.status || "")) return NextResponse.json({ error: "Invalid response" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("event_cohosts").update({ status: body.status, responded_at: new Date().toISOString() }).eq("event_id", body.eventId).eq("user_id", user.id).eq("status", "pending").select("event_id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  return NextResponse.json({ updated: true });
}
