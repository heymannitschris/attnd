import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { count, error } = await supabase.from("push_devices").select("token", { count: "exact", head: true }).eq("user_id", user.id).eq("platform", "ios").eq("enabled", true);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ registered: (count || 0) > 0, count: count || 0 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json() as { token?: string; platform?: "ios" | "web"; environment?: "development" | "production" };
  if (!body.token || body.token.length < 32) return NextResponse.json({ error: "Invalid device token" }, { status: 400 });
  const { error } = await supabase.from("push_devices").upsert({ user_id: user.id, token: body.token, platform: body.platform || "ios", environment: body.environment || "production", enabled: true, last_seen_at: new Date().toISOString() }, { onConflict: "token" });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ registered: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { token } = await request.json() as { token?: string };
  if (token) await supabase.from("push_devices").update({ enabled: false }).eq("user_id", user.id).eq("token", token);
  return NextResponse.json({ disabled: true });
}
