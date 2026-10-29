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
  const { data: memberships, error } = await admin.from("event_team_members")
    .select("id,event_id,role_title,compensation_type,compensation_percent,fixed_amount_minor,currency,can_check_in,status,created_at,events(id,slug,title,cover_url,starts_at,status,host_id)")
    .eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const eventIds = (memberships || []).map((membership) => membership.event_id);
  const { data: allocations } = eventIds.length ? await admin.from("revenue_allocations")
    .select("event_id,amount_minor,currency,status,available_at").eq("user_id", user.id).eq("role", "team").in("event_id", eventIds) : { data: [] };
  const teamMemberships = (memberships || []).map((membership) => {
    const rows = (allocations || []).filter((allocation) => allocation.event_id === membership.event_id && allocation.status === "earned");
    return { ...membership, earnedMinor: rows.reduce((sum, row) => sum + row.amount_minor, 0), availableMinor: rows.filter((row) => new Date(row.available_at).getTime() <= Date.now()).reduce((sum, row) => sum + row.amount_minor, 0) };
  });

  const eventId = new URL(request.url).searchParams.get("eventId");
  let managedTeam: unknown[] = [];
  if (eventId) {
    const { data: event } = await admin.from("events").select("host_id").eq("id", eventId).maybeSingle();
    if (event?.host_id === user.id) {
      const { data: members } = await admin.from("event_team_members")
        .select("id,user_id,role_title,compensation_type,compensation_percent,fixed_amount_minor,currency,can_check_in,status,created_at,profiles!event_team_members_user_id_fkey(first_name,username,avatar_url)")
        .eq("event_id", eventId).order("created_at", { ascending: true });
      const userIds = (members || []).map((member) => member.user_id);
      const { data: teamAllocations } = userIds.length ? await admin.from("revenue_allocations")
        .select("user_id,amount_minor,status").eq("event_id", eventId).eq("role", "team").in("user_id", userIds) : { data: [] };
      managedTeam = (members || []).map((member) => ({ ...member, earnedMinor: (teamAllocations || []).filter((row) => row.user_id === member.user_id && row.status === "earned").reduce((sum, row) => sum + row.amount_minor, 0) }));
    }
  }
  return NextResponse.json({ memberships: teamMemberships, managedTeam });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { eventId?: string; username?: string; roleTitle?: string; compensationType?: "percentage" | "fixed"; compensationValue?: number; currency?: string; canCheckIn?: boolean } | null;
  const roleTitle = body?.roleTitle?.trim() || "";
  const compensationValue = Number(body?.compensationValue);
  const currency = String(body?.currency || "thb").toLowerCase();
  if (!body?.eventId || !body.username || roleTitle.length < 2 || roleTitle.length > 60 || !["percentage", "fixed"].includes(body.compensationType || "") || !Number.isFinite(compensationValue) || !/^[a-z]{3}$/.test(currency)) {
    return NextResponse.json({ error: "Complete the event, teammate, role and compensation." }, { status: 400 });
  }
  if (body.compensationType === "percentage" && (compensationValue <= 0 || compensationValue > 100)) return NextResponse.json({ error: "Revenue share must be between 0 and 100%." }, { status: 400 });
  if (body.compensationType === "fixed" && compensationValue < 50) return NextResponse.json({ error: "Fixed compensation must be at least 50.00." }, { status: 400 });
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id,title,host_id").eq("id", body.eventId).maybeSingle();
  if (!event || event.host_id !== user.id) return NextResponse.json({ error: "Only the event host can manage the team." }, { status: 403 });
  const username = body.username.trim().replace(/^@/, "").toLowerCase();
  const { data: person } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
  if (!person || person.id === user.id) return NextResponse.json({ error: "Team member account not found." }, { status: 404 });
  const [{ data: cohosts }, { data: percentageMembers }] = await Promise.all([
    admin.from("event_cohosts").select("user_id,revenue_share_percent,status").eq("event_id", event.id).neq("status", "declined"),
    admin.from("event_team_members").select("user_id,compensation_percent,status").eq("event_id", event.id).eq("compensation_type", "percentage").in("status", ["pending", "accepted"]),
  ]);
  const allocated = (cohosts || []).reduce((sum, row) => sum + row.revenue_share_percent, 0)
    + (percentageMembers || []).filter((row) => row.user_id !== person.id).reduce((sum, row) => sum + Number(row.compensation_percent || 0), 0);
  if (body.compensationType === "percentage" && allocated + compensationValue > 100) return NextResponse.json({ error: `Only ${Math.max(0, 100 - allocated)}% revenue share remains.` }, { status: 400 });
  const { error } = await admin.from("event_team_members").upsert({
    event_id: event.id, user_id: person.id, invited_by: user.id, role_title: roleTitle,
    compensation_type: body.compensationType,
    compensation_percent: body.compensationType === "percentage" ? compensationValue : null,
    fixed_amount_minor: body.compensationType === "fixed" ? Math.round(compensationValue * 100) : null,
    currency, can_check_in: Boolean(body.canCheckIn), status: "pending", responded_at: null,
  }, { onConflict: "event_id,user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from("notifications").insert({ user_id: person.id, category: "Events", title: "Event team invitation", body: `You were invited as ${roleTitle} for ${event.title}.`, href: "/dashboard?tab=team" });
  return NextResponse.json({ invited: true });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { membershipId?: string; status?: "accepted" | "declined" } | null;
  if (!body?.membershipId || !["accepted", "declined"].includes(body.status || "")) return NextResponse.json({ error: "Invalid response." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("event_team_members").update({ status: body.status, responded_at: new Date().toISOString() })
    .eq("id", body.membershipId).eq("user_id", user.id).eq("status", "pending").select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  return NextResponse.json({ updated: true });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const membershipId = new URL(request.url).searchParams.get("membershipId");
  if (!membershipId) return NextResponse.json({ error: "Membership is required." }, { status: 400 });
  const admin = createAdminClient();
  const { data: membership } = await admin.from("event_team_members").select("id,event_id").eq("id", membershipId).maybeSingle();
  if (!membership) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  const { data: event } = await admin.from("events").select("host_id").eq("id", membership.event_id).maybeSingle();
  if (event?.host_id !== user.id) return NextResponse.json({ error: "Only the event host can remove team members." }, { status: 403 });
  const { error } = await admin.from("event_team_members").update({ status: "revoked", responded_at: new Date().toISOString() }).eq("id", membership.id);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ revoked: true });
}
