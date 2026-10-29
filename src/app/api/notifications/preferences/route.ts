import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await supabase.from("profiles").select("notification_preferences").eq("id", user.id).single();
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ preferences: data.notification_preferences });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { preferences } = await request.json() as { preferences?: Record<string, boolean> };
  if (!preferences) return NextResponse.json({ error: "Preferences are required" }, { status: 400 });
  const allowed = ["invites", "sales", "transfers", "earnings", "updates", "reminders", "followers", "mentions", "news", "push_enabled", "email_enabled"];
  const { data: profile } = await supabase.from("profiles").select("notification_preferences").eq("id", user.id).single();
  const current = (profile?.notification_preferences || {}) as Record<string, boolean>;
  const safe = { ...current, ...Object.fromEntries(allowed.filter((key) => key in preferences).map((key) => [key, preferences[key] !== false])) };
  const { error } = await supabase.from("profiles").update({ notification_preferences: safe }).eq("id", user.id);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ saved: true });
}
