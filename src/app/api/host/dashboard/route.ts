import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Event is required" }, { status: 400 });
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id,slug,title,status,starts_at,ends_at,cover_url,venue_name,city,host_id").eq("id", eventId).maybeSingle();
  if (!event || event.host_id !== user.id) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const [tiersResult, ordersResult, ticketsResult, guestlistResult, teamResult, cohostsResult, waitlistResult, refundsResult, localRuleResult] = await Promise.all([
    admin.from("ticket_types").select("id,name,price_minor,currency,quantity,sold_count,reserved_count,active").eq("event_id", eventId).order("created_at"),
    admin.from("orders").select("id,payment_status,subtotal_minor,total_minor,currency,created_at").eq("event_id", eventId).order("created_at", { ascending: false }),
    admin.from("tickets").select("id,status").eq("event_id", eventId),
    admin.from("event_guestlist_entries").select("id,status,plus_ones").eq("event_id", eventId).neq("status", "cancelled"),
    admin.from("event_team_members").select("id,status,can_check_in").eq("event_id", eventId).neq("status", "revoked"),
    admin.from("event_cohosts").select("user_id,status").eq("event_id", eventId).neq("status", "declined"),
    admin.from("event_waitlist").select("id,user_id,ticket_type_id,quantity,status,offer_expires_at,created_at,profiles(first_name,username),ticket_types(name)").eq("event_id", eventId).in("status", ["waiting", "offered"]).order("created_at"),
    admin.from("refund_requests").select("id,reason,status,created_at,orders!inner(event_id,total_minor,currency),requester:profiles!refund_requests_requester_id_fkey(first_name,username)").eq("orders.event_id", eventId).order("created_at", { ascending: false }),
    admin.from("event_local_access_rules").select("enabled,locality,benefit_type,discount_percent,capacity,redeemed_count").eq("event_id", eventId).maybeSingle(),
  ]);
  const error = [tiersResult, ordersResult, ticketsResult, guestlistResult, teamResult, cohostsResult, waitlistResult, refundsResult].find((result) => result.error)?.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tiers = tiersResult.data || [];
  const orders = ordersResult.data || [];
  const tickets = ticketsResult.data || [];
  const guestlist = guestlistResult.data || [];
  const team = teamResult.data || [];
  const paidOrders = orders.filter((order) => order.payment_status === "paid");
  const revenueByCurrency = Object.entries(paidOrders.reduce<Record<string, number>>((totals, order) => { totals[order.currency] = (totals[order.currency] || 0) + order.subtotal_minor; return totals; }, {})).map(([currency, amountMinor]) => ({ currency, amountMinor }));
  const ticketAttendees = tickets.filter((ticket) => ticket.status === "valid" || ticket.status === "used").length;
  const guestAttendees = guestlist.reduce((sum, guest) => sum + 1 + guest.plus_ones, 0);
  const checkedIn = tickets.filter((ticket) => ticket.status === "used").length + guestlist.filter((guest) => guest.status === "arrived").reduce((sum, guest) => sum + 1 + guest.plus_ones, 0);
  return NextResponse.json({
    event: { ...event, host_id: undefined },
    summary: {
      capacity: tiers.filter((tier) => tier.active).reduce((sum, tier) => sum + tier.quantity, 0),
      attendees: ticketAttendees + guestAttendees,
      checkedIn,
      paidOrders: paidOrders.length,
      refundedOrders: orders.filter((order) => order.payment_status === "refunded").length,
      revenueByCurrency,
      waitlist: (waitlistResult.data || []).filter((entry) => entry.status === "waiting").length,
      offers: (waitlistResult.data || []).filter((entry) => entry.status === "offered").length,
      team: team.filter((member) => member.status === "accepted").length + (cohostsResult.data || []).filter((member) => member.status === "accepted").length,
      checkInStaff: team.filter((member) => member.status === "accepted" && member.can_check_in).length,
      guestlist: guestAttendees,
      openRefunds: (refundsResult.data || []).filter((refund) => refund.status === "open" || refund.status === "needs_info").length,
    },
    tiers,
    waitlist: waitlistResult.data || [],
    refunds: refundsResult.data || [],
    localRule: localRuleResult.data,
  });
}
