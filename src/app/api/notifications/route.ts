import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await supabase.from("notifications").select("id,category,title,body,href,metadata,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ notifications: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { id, all } = await request.json() as { id?: string; all?: boolean };
  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id);
  if (!all && id) query = query.eq("id", id);
  const { error } = await query;
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ updated: true });
}
