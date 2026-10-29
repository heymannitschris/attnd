import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "video/mp4", "video/quicktime"]);

async function resolveEvent(id: string) {
  const admin = createAdminClient();
  const byId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id);
  return admin.from("events").select("id,slug,title,status,starts_at,ends_at,live_discovery_enabled").eq(byId ? "id" : "slug", id).eq("status", "published").maybeSingle();
}

export async function GET(_request: Request, context: RouteContext<"/api/events/[id]/live-moments">) {
  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: event } = await resolveEvent(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const now = Date.now();
  const liveNow = Boolean(event.live_discovery_enabled && event.starts_at && event.ends_at && new Date(event.starts_at).getTime() <= now && new Date(event.ends_at).getTime() >= now);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let canUpload = false;
  if (user) {
    const { data: ticket } = await admin.from("tickets").select("id").eq("event_id", event.id).eq("owner_id", user.id).eq("status", "used").limit(1).maybeSingle();
    if (ticket) {
      const { count } = await admin.from("ticket_checkins").select("id", { count: "exact", head: true }).eq("ticket_id", ticket.id);
      canUpload = liveNow && Boolean(count);
    }
  }

  const { data, error } = await admin.from("event_live_moments")
    .select("id,user_id,public_url,kind,caption,created_at,profiles!event_live_moments_user_id_fkey(first_name,username,avatar_url)")
    .eq("event_id", event.id).eq("status", "published").order("created_at", { ascending: false }).limit(40);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ event, canUpload, moments: data || [] });
}

export async function POST(request: Request, context: RouteContext<"/api/events/[id]/live-moments">) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload a moment" }, { status: 401 });
  const admin = createAdminClient();
  const { data: event } = await resolveEvent(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const now = Date.now();
  if (!event.live_discovery_enabled || !event.starts_at || !event.ends_at || new Date(event.starts_at).getTime() > now || new Date(event.ends_at).getTime() < now) return NextResponse.json({ error: "Live uploads are only open while this event is running" }, { status: 409 });

  const { data: ticket } = await admin.from("tickets").select("id").eq("event_id", event.id).eq("owner_id", user.id).eq("status", "used").limit(1).maybeSingle();
  if (!ticket) return NextResponse.json({ error: "You can upload after checking in at this event" }, { status: 403 });
  const { count } = await admin.from("ticket_checkins").select("id", { count: "exact", head: true }).eq("ticket_id", ticket.id);
  if (!count) return NextResponse.json({ error: "You can upload after checking in at this event" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose a photo or video" }, { status: 400 });
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Use a JPG, PNG, WebP, HEIC, MP4 or MOV file" }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "The file must be smaller than 50 MB" }, { status: 400 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${user.id}/live/${event.id}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await admin.storage.from("event-media").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
  const publicUrl = admin.storage.from("event-media").getPublicUrl(path).data.publicUrl;
  const { data: moment, error } = await admin.from("event_live_moments").insert({
    event_id: event.id, user_id: user.id, storage_path: path, public_url: publicUrl,
    kind: file.type.startsWith("video/") ? "video" : "photo",
    caption: String(form.get("caption") || "").trim().slice(0, 180),
  }).select("id,user_id,public_url,kind,caption,created_at").single();
  if (error) {
    await admin.storage.from("event-media").remove([path]);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ moment });
}
