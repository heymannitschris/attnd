import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function refreshCover(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string, userId: string) {
  const { data: cover } = await supabase.from("event_media").select("public_url").eq("event_id", eventId).eq("kind", "photo").order("position", { ascending: true }).limit(1).maybeSingle();
  if (cover?.public_url) await supabase.from("events").update({ cover_url: cover.public_url }).eq("id", eventId).eq("host_id", userId);
}

export async function PATCH(request: Request, context: RouteContext<"/api/events/[id]/media">) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: event } = await supabase.from("events").select("id").eq("id", id).eq("host_id", user.id).maybeSingle();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const body = await request.json() as { items?: Array<{ id?: string; position?: number }> };
  const items = Array.isArray(body.items) ? body.items.slice(0, 10) : [];
  if (!items.length || items.some((item) => !item.id || !Number.isInteger(item.position) || Number(item.position) < 0 || Number(item.position) > 9)) {
    return NextResponse.json({ error: "A valid gallery order is required" }, { status: 400 });
  }
  const ids = items.map((item) => String(item.id));
  if (new Set(ids).size !== ids.length || new Set(items.map((item) => item.position)).size !== items.length) {
    return NextResponse.json({ error: "Gallery positions must be unique" }, { status: 400 });
  }
  const { data: ownedMedia, error: mediaError } = await supabase.from("event_media").select("id").eq("event_id", id).in("id", ids);
  if (mediaError || ownedMedia?.length !== ids.length) return NextResponse.json({ error: mediaError?.message || "Gallery item not found" }, { status: 400 });

  for (const item of items) {
    const { error } = await supabase.from("event_media").update({ position: item.position }).eq("id", item.id).eq("event_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  await refreshCover(supabase, id, user.id);
  return NextResponse.json({ success: true });
}

export async function POST(request: Request, context: RouteContext<"/api/events/[id]/media">) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: event } = await supabase.from("events").select("id").eq("id", id).eq("host_id", user.id).maybeSingle();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = await request.json() as { path?: string; contentType?: string; size?: number; category?: string; description?: string; position?: number };
    const kind = body.contentType?.startsWith("video/") ? "video" : "photo";
    const allowed = kind === "video" ? ["video/mp4", "video/quicktime", "video/webm"] : ["image/jpeg", "image/png", "image/webp", "image/heic"];
    const maximum = kind === "video" ? 80 * 1024 * 1024 : 10 * 1024 * 1024;
    if (!body.path?.startsWith(`${user.id}/${id}/`) || !body.contentType || !allowed.includes(body.contentType) || !body.size || body.size > maximum) {
      return NextResponse.json({ error: kind === "video" ? "Optimized videos must be MP4, MOV or WEBM and no larger than 80 MB." : "Images must be JPG, PNG, WEBP or HEIC and no larger than 10 MB." }, { status: 400 });
    }
    const publicUrl = supabase.storage.from("event-media").getPublicUrl(body.path).data.publicUrl;
    const { data: media, error } = await supabase.from("event_media").insert({
      event_id: id, storage_path: body.path, public_url: publicUrl, kind,
      category: body.category || "Atmosphere", description: body.description || "", position: Number(body.position || 0),
    }).select("id, public_url").single();
    if (error) {
      await supabase.storage.from("event-media").remove([body.path]);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    await refreshCover(supabase, id, user.id);
    return NextResponse.json({ media });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "No media file provided" }, { status: 400 });
  const kind = file.type.startsWith("video/") ? "video" : "photo";
  const allowed = kind === "video" ? ["video/mp4", "video/quicktime", "video/webm"] : ["image/jpeg", "image/png", "image/webp", "image/heic"];
  const maximum = kind === "video" ? 80 * 1024 * 1024 : 10 * 1024 * 1024;
  if (!allowed.includes(file.type) || file.size > maximum) return NextResponse.json({ error: kind === "video" ? "Optimized videos must be MP4, MOV or WEBM and no larger than 80 MB." : "Images must be JPG, PNG, WEBP or HEIC and no larger than 10 MB." }, { status: 400 });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${user.id}/${id}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("event-media").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
  const publicUrl = supabase.storage.from("event-media").getPublicUrl(path).data.publicUrl;
  const { data: media, error } = await supabase.from("event_media").insert({
    event_id: id, storage_path: path, public_url: publicUrl,
    kind,
    category: String(form.get("category") || "Atmosphere"),
    description: String(form.get("description") || ""),
    position: Number(form.get("position") || 0),
  }).select("id, public_url").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await refreshCover(supabase, id, user.id);
  return NextResponse.json({ media });
}
