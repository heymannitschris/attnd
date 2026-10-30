import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { confirm?: string };
  if (body.confirm !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });

  const admin = createAdminClient();

  // Hosts with events that already have sold tickets must be handed over first,
  // otherwise attendees would lose their tickets.
  const { data: hostedEvents, error: eventsError } = await admin.from("events").select("id").eq("host_id", user.id);
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });
  const eventIds = (hostedEvents || []).map((event) => event.id as string);
  if (eventIds.length) {
    const { count, error } = await admin.from("orders").select("id", { count: "exact", head: true }).in("event_id", eventIds).in("payment_status", ["paid", "free"]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (count) return NextResponse.json({ error: "You host events with issued tickets. Please contact info@ninjaworld.games so we can transfer or close them before deleting your account." }, { status: 409 });
  }

  const { error: anonymizeError } = await admin.rpc("anonymize_account_for_deletion", { target_user: user.id });
  if (anonymizeError) return NextResponse.json({ error: anonymizeError.message }, { status: 500 });

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  await supabase.auth.signOut().catch(() => undefined);
  return NextResponse.json({ deleted: true });
}
