import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Allocation = { order_id: string; event_id: string; amount_minor: number; currency: string; available_at: string; status: string; created_at: string };
type Payout = { id: string; amount_minor: number; fee_minor: number; currency: string; status: string; created_at: string; paid_at: string | null };

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const requestedSource = new URL(request.url).searchParams.get("source");
  const source = requestedSource === "cohost" || requestedSource === "team" ? requestedSource : "host";
  const admin = createAdminClient();
  const allocations: Allocation[] = [];
  const payouts: Payout[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.from("revenue_allocations")
      .select("order_id,event_id,amount_minor,currency,available_at,status,created_at")
      .eq("user_id", user.id).eq("role", source).order("created_at", { ascending: false }).range(offset, offset + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    allocations.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.from("payout_requests")
      .select("id,amount_minor,fee_minor,currency,status,created_at,paid_at")
      .eq("user_id", user.id).eq("source", source).order("created_at", { ascending: false }).range(offset, offset + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    payouts.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const eventIds = [...new Set(allocations.map((item) => item.event_id))];
  const { data: events, error: eventsError } = eventIds.length ? await admin.from("events").select("id,slug,title,cover_url,starts_at").in("id", eventIds) : { data: [], error: null };
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 400 });
  const now = Date.now();
  const currencies = [...new Set([...allocations.map((item) => item.currency), ...payouts.map((item) => item.currency)])];
  if (!currencies.length) currencies.push("thb");
  const balances = currencies.map((currency) => {
    const rows = allocations.filter((item) => item.currency === currency && item.status === "earned");
    const paid = payouts.filter((item) => item.currency === currency && item.status === "paid").reduce((sum, item) => sum + item.amount_minor, 0);
    const reserved = payouts.filter((item) => item.currency === currency && ["pending", "processing"].includes(item.status)).reduce((sum, item) => sum + item.amount_minor, 0);
    const eligible = rows.filter((item) => new Date(item.available_at).getTime() <= now).reduce((sum, item) => sum + item.amount_minor, 0);
    const total = rows.reduce((sum, item) => sum + item.amount_minor, 0);
    return { currency, totalMinor: total, availableMinor: Math.max(0, eligible - paid - reserved), pendingMinor: Math.max(0, total - eligible) + reserved, transferredMinor: paid };
  });
  const byEvent = (events || []).map((event) => {
    const rows = allocations.filter((item) => item.event_id === event.id && item.status === "earned");
    return { id: event.id, slug: event.slug, title: event.title, coverUrl: event.cover_url, startsAt: event.starts_at,
      currencies: [...new Set(rows.map((item) => item.currency))].map((currency) => ({ currency, amountMinor: rows.filter((item) => item.currency === currency).reduce((sum, item) => sum + item.amount_minor, 0), sales: rows.filter((item) => item.currency === currency).length })) };
  });
  return NextResponse.json({ source, balances, byEvent, payouts, activity: allocations.filter((item) => item.status === "earned").map((item) => ({ eventId: item.event_id, amountMinor: item.amount_minor, currency: item.currency, createdAt: item.created_at })) });
}
