import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const eventValue = new URL(request.url).searchParams.get("event");
  if (!eventValue) return NextResponse.json({ error: "Event is required" }, { status: 400 });
  const admin = createAdminClient();
  const query = admin.from("events").select("id,title").eq("host_id", user.id);
  const { data: event } = await (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(eventValue) ? query.eq("id", eventValue) : query.eq("slug", eventValue)).maybeSingle();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const { data: commissions, error } = await admin.from("affiliate_commissions").select("affiliate_user_id,amount_minor,currency,orders(subtotal_minor,order_items(quantity)),profiles!affiliate_commissions_affiliate_user_id_fkey(first_name,username,avatar_url,city)").eq("event_id", event.id).neq("status", "reversed");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const grouped = new Map<string, { affiliateId: string; name: string; handle: string; avatarUrl: string | null; city: string; sales: number; grossMinor: number; amountMinor: number; currency: string }>();
  for (const row of commissions || []) {
    const profile = row.profiles as unknown as { first_name: string | null; username: string | null; avatar_url: string | null; city: string | null } | null;
    const existing = grouped.get(row.affiliate_user_id) || { affiliateId: row.affiliate_user_id, name: profile?.first_name || profile?.username || "Affiliate", handle: profile?.username ? `@${profile.username}` : "Attnd affiliate", avatarUrl: profile?.avatar_url || null, city: profile?.city || "", sales: 0, grossMinor: 0, amountMinor: 0, currency: row.currency };
    const order = row.orders as unknown as { subtotal_minor?: number; order_items?: Array<{ quantity: number }> } | null;
    const items = order?.order_items || [];
    existing.sales += items.reduce((sum, item) => sum + item.quantity, 0);
    existing.grossMinor += order?.subtotal_minor || 0;
    existing.amountMinor += row.amount_minor;
    grouped.set(row.affiliate_user_id, existing);
  }
  return NextResponse.json({ event: { id: event.id, title: event.title }, affiliates: [...grouped.values()] });
}
