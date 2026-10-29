import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ awarded: false }, { status: 401 });
  const body = await request.json() as { eventId?: string; direction?: "left" | "right" };
  const eventId = body.eventId?.trim();
  if (!eventId || eventId.length > 120 || !/^[a-zA-Z0-9_-]+$/.test(eventId)) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  const { data, error } = await createAdminClient().rpc("award_user_points", {
    p_user_id: user.id,
    p_amount: 1,
    p_source: "discover_swipe",
    p_idempotency_key: `swipe:${user.id}:${eventId}`,
    p_metadata: { event_id: eventId, direction: body.direction === "right" ? "right" : "left" },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ awarded: Boolean(data) });
}
