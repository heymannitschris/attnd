import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { promoteWaitlist } from "@/lib/waitlist";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ entries: [] });
  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Event is required" }, { status: 400 });
  const admin = createAdminClient();
  const { data: rows, error } = await admin.from("event_waitlist").select("id,ticket_type_id,quantity,status,offer_expires_at,created_at").eq("event_id", eventId).eq("user_id", user.id).in("status", ["waiting", "offered"]).order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const entries = await Promise.all((rows || []).map(async (entry) => {
    if (entry.status === "offered" && entry.offer_expires_at && new Date(entry.offer_expires_at).getTime() <= Date.now()) return { ...entry, status: "expired", position: null };
    if (entry.status === "offered") return { ...entry, position: 0 };
    const { count } = await admin.from("event_waitlist").select("id", { count: "exact", head: true }).eq("ticket_type_id", entry.ticket_type_id).eq("status", "waiting").lt("created_at", entry.created_at);
    return { ...entry, position: (count || 0) + 1 };
  }));
  return NextResponse.json({ entries: entries.filter((entry) => entry.status !== "expired") });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in to join the waitlist", loginRequired: true }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { eventId?: string; ticketTypeId?: string; quantity?: number };
  if (!body.eventId || !body.ticketTypeId) return NextResponse.json({ error: "Ticket type is required" }, { status: 400 });
  const { data: id, error } = await supabase.rpc("join_event_waitlist", { p_event_id: body.eventId, p_ticket_type_id: body.ticketTypeId, p_quantity: Math.max(1, Math.min(10, Number(body.quantity) || 1)) });
  return error ? NextResponse.json({ error: error.message }, { status: 409 }) : NextResponse.json({ joined: true, id });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Waitlist entry is required" }, { status: 400 });
  const { data: ticketTypeId, error } = await supabase.rpc("leave_event_waitlist", { p_waitlist_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (ticketTypeId) await promoteWaitlist(ticketTypeId);
  return NextResponse.json({ left: true });
}
