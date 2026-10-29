import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await supabase.from("profiles").select("id,first_name,username,avatar_url,city,notification_preferences").neq("id", user.id).order("first_name").limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const profiles = (data || []).filter((profile) => {
    const preferences = (profile.notification_preferences || {}) as Record<string, unknown>;
    return preferences.allow_event_invites !== false;
  }).map((profile) => ({ id: profile.id, first_name: profile.first_name, username: profile.username, avatar_url: profile.avatar_url, city: profile.city }));
  return NextResponse.json({ profiles });
}
