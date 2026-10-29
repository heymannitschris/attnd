import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const admin = createAdminClient();
  if (user.email) {
    await admin.from("event_guestlist_entries").update({ user_id: user.id }).is("user_id", null).ilike("guest_email", user.email).neq("status", "cancelled");
  }
  const { data, error } = await admin.from("event_guestlist_entries")
    .select("id,guest_name,guest_email,plus_ones,notes,status,access_token,arrived_at,created_at,events!inner(id,slug,title,cover_url,starts_at,ends_at,venue_name,city,status)")
    .eq("user_id", user.id).neq("status", "cancelled").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ passes: data || [] });
}
