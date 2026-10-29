import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ eligible: false });
  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ eligible: false });
  const admin = createAdminClient();
  const [{ data: rule }, { data: membership }, { data: redemption }] = await Promise.all([
    admin.from("event_local_access_rules").select("enabled,locality,benefit_type,discount_percent,capacity,redeemed_count").eq("event_id", eventId).eq("enabled", true).maybeSingle(),
    admin.from("local_memberships").select("locality,status,expires_at").eq("user_id", user.id).eq("status", "verified").maybeSingle(),
    admin.from("local_access_redemptions").select("id").eq("event_id", eventId).eq("user_id", user.id).maybeSingle(),
  ]);
  const validMembership = Boolean(rule && membership && membership.locality.toLowerCase() === rule.locality.toLowerCase() && (!membership.expires_at || new Date(membership.expires_at).getTime() > Date.now()));
  const capacityAvailable = Boolean(rule && (rule.capacity == null || rule.redeemed_count < rule.capacity));
  return NextResponse.json({ eligible: validMembership && capacityAvailable && !redemption, alreadyUsed: Boolean(redemption), rule: validMembership ? rule : null });
}
