import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const [{ data: commissions, error }, { data: payouts }, { data: referrals }] = await Promise.all([
    supabase.from("affiliate_commissions").select("id,event_id,amount_minor,currency,status,created_at,available_at,events(title,slug,cover_url),orders(buyer_id,order_items(quantity))").eq("affiliate_user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("payout_requests").select("amount_minor,currency,status,created_at").eq("user_id", user.id).eq("source", "affiliate").order("created_at", { ascending: false }),
    supabase.from("user_referrals").select("referred_user_id,created_at,profiles!user_referrals_referred_user_id_fkey(first_name,username,avatar_url)").eq("affiliate_user_id", user.id).order("created_at", { ascending: false }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const visits: Array<{ event_id: string | null; visitor_key: string }> = [];
  const invites: Array<{ event_id: string | null; status: string }> = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error: visitsError } = await supabase.from("affiliate_link_visits")
      .select("event_id,visitor_key").eq("affiliate_user_id", user.id)
      .order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
    if (visitsError) return NextResponse.json({ error: visitsError.message }, { status: 400 });
    visits.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  for (let offset = 0; ; offset += pageSize) {
    const { data, error: invitesError } = await supabase.from("event_invites")
      .select("event_id,status").eq("inviter_id", user.id)
      .order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
    if (invitesError) return NextResponse.json({ error: invitesError.message }, { status: 400 });
    invites.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  const currency = commissions?.[0]?.currency || payouts?.[0]?.currency || "eur";
  const currencyCommissions = (commissions || []).filter((item) => item.currency === currency && item.status !== "reversed");
  const paidOut = (payouts || []).filter((item) => item.currency === currency && item.status === "paid").reduce((sum, item) => sum + item.amount_minor, 0);
  const reserved = (payouts || []).filter((item) => item.currency === currency && (item.status === "pending" || item.status === "processing")).reduce((sum, item) => sum + item.amount_minor, 0);
  const earned = currencyCommissions.reduce((sum, item) => sum + item.amount_minor, 0);
  const eligible = currencyCommissions.filter((item) => item.status === "available" || item.status === "paid").filter((item) => new Date(item.available_at).getTime() <= Date.now()).reduce((sum, item) => sum + item.amount_minor, 0);
  const eventIds = [...new Set([...(visits || []).map((item) => item.event_id), ...(invites || []).map((item) => item.event_id), ...(commissions || []).map((item) => item.event_id)].filter((id): id is string => Boolean(id)))];
  const { data: promotedEventRows } = eventIds.length ? await supabase.from("events").select("id,slug,title,cover_url").in("id", eventIds) : { data: [] };
  const promotedEvents = (promotedEventRows || []).map((event) => {
    const eventCommissions = (commissions || []).filter((item) => item.event_id === event.id && item.status !== "reversed");
    const eventVisits = (visits || []).filter((item) => item.event_id === event.id);
    return { id: event.id, slug: event.slug, title: event.title, coverUrl: event.cover_url, clicks: eventVisits.length, uniqueVisitors: new Set(eventVisits.map((item) => item.visitor_key)).size, acceptedInvites: (invites || []).filter((item) => item.event_id === event.id && item.status === "joined").length, sales: eventCommissions.length, earnedMinor: eventCommissions.reduce((sum, item) => sum + item.amount_minor, 0), currency: eventCommissions[0]?.currency || "eur" };
  });
  const lifetimeReferrals = (referrals || []).map((row) => {
    const profile = row.profiles as unknown as { first_name: string | null; username: string | null; avatar_url: string | null } | null;
    const userCommissions = (commissions || []).filter((item) => item.status !== "reversed" && (item.orders as unknown as { buyer_id?: string } | null)?.buyer_id === row.referred_user_id);
    return { userId: row.referred_user_id, name: profile?.first_name || profile?.username || "Attnd user", username: profile?.username || "", avatarUrl: profile?.avatar_url || null, joinedAt: row.created_at, sales: userCommissions.length, earnedMinor: userCommissions.reduce((sum, item) => sum + item.amount_minor, 0), currency: userCommissions[0]?.currency || "eur" };
  });
  const allVisits = visits || [];
  return NextResponse.json({ userId: user.id, totalMinor: earned, availableMinor: Math.max(0, eligible - paidOut - reserved), pendingMinor: Math.max(0, earned - eligible) + reserved, paidMinor: paidOut, currency, commissions: commissions || [], payouts: payouts || [], promotedEvents, lifetimeReferrals, stats: { clicks: allVisits.length, uniqueVisitors: new Set(allVisits.map((item) => item.visitor_key)).size, acceptedInvites: (invites || []).filter((item) => item.status === "joined").length, sales: (commissions || []).filter((item) => item.status !== "reversed").length } });
}
