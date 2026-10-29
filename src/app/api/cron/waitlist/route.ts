import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { promoteWaitlist } from "@/lib/waitlist";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: expired, error } = await admin.rpc("expire_event_waitlist_offers");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: queues } = await admin.from("event_waitlist").select("ticket_type_id").eq("status", "waiting");
  const ticketTypes = [...new Set([...(expired || []), ...(queues || []).map((entry) => entry.ticket_type_id)])];
  let promoted = 0;
  for (const ticketTypeId of ticketTypes) promoted += (await promoteWaitlist(ticketTypeId)).length;
  return NextResponse.json({ expired: (expired || []).length, promoted });
}
