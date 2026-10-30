import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function eventByReference(supabase: Awaited<ReturnType<typeof createClient>>, eventRef: string) {
  const column = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(eventRef) ? "id" : "slug";
  return supabase.from("events").select("id,slug").eq(column, eventRef).eq("status", "published").maybeSingle();
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ saved: [] });
  const { data, error } = await supabase.from("event_saves").select("events!inner(slug)").eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const saved = (data || []).map((row) => {
    const event = row.events as unknown as { slug: string } | null;
    return event?.slug;
  }).filter(Boolean);
  return NextResponse.json({ saved }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to save events", loginRequired: true }, { status: 401 });
  const { eventRef } = await request.json().catch(() => ({})) as { eventRef?: string };
  if (!eventRef) return NextResponse.json({ error: "Event is required" }, { status: 400 });
  const { data: event } = await eventByReference(supabase, eventRef);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const { error } = await supabase.from("event_saves").upsert({ user_id: user.id, event_id: event.id }, { onConflict: "user_id,event_id" });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ saved: true, slug: event.slug });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const eventRef = new URL(request.url).searchParams.get("eventRef");
  if (!eventRef) return NextResponse.json({ error: "Event is required" }, { status: 400 });
  const { data: event } = await eventByReference(supabase, eventRef);
  if (!event) return NextResponse.json({ removed: true });
  const { error } = await supabase.from("event_saves").delete().eq("user_id", user.id).eq("event_id", event.id);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ removed: true });
}
