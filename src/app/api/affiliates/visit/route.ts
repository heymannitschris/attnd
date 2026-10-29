import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { affiliateId?: string; visitorKey?: string; eventSlug?: string; momentId?: string } | null;
  if (!body?.affiliateId || !body.visitorKey || !uuid.test(body.affiliateId) || !uuid.test(body.visitorKey)) {
    return NextResponse.json({ error: "Invalid visit" }, { status: 400 });
  }
  const admin = createAdminClient();
  let eventId: string | null = null;
  if (body.eventSlug) {
    const { data: event } = await admin.from("events").select("id").eq("slug", body.eventSlug).eq("status", "published").maybeSingle();
    eventId = event?.id || null;
  }
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const existingQuery = admin.from("affiliate_link_visits").select("id").eq("affiliate_user_id", body.affiliateId).eq("visitor_key", body.visitorKey).gte("created_at", oneMinuteAgo);
  const { data: existing } = await (eventId ? existingQuery.eq("event_id", eventId) : existingQuery.is("event_id", null)).limit(1);
  if (existing?.length) return NextResponse.json({ recorded: false });
  const momentId = body.momentId && uuid.test(body.momentId) ? body.momentId : null;
  const { error } = await admin.from("affiliate_link_visits").insert({ affiliate_user_id: body.affiliateId, visitor_key: body.visitorKey, event_id: eventId, moment_id: momentId });
  if (error) return NextResponse.json({ error: "Visit could not be recorded" }, { status: 400 });
  return NextResponse.json({ recorded: true });
}
