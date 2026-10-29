import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };

async function resolveEvent(id: string) {
  const admin = createAdminClient();
  const query = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)
    ? admin.from("events").select("id,host_id,ends_at").eq("id", id)
    : admin.from("events").select("id,host_id,ends_at").eq("slug", id);
  const { data } = await query.maybeSingle();
  return data || null;
}

export async function GET(_: Request, context: Context) {
  const { id } = await context.params;
  const event = await resolveEvent(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const [{ data: reviews, error }, ticketResult, ownResult, ownHostResult] = await Promise.all([
    admin.from("event_reviews").select("id,rating,body,created_at,updated_at,user_id,profiles!event_reviews_user_id_fkey(first_name,username,avatar_url)").eq("event_id", event.id).eq("status", "published").order("created_at", { ascending: false }).limit(100),
    user ? admin.from("tickets").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("owner_id", user.id).in("status", ["valid", "used"]) : Promise.resolve({ count: 0 }),
    user ? admin.from("event_reviews").select("id,rating,body,status,created_at,updated_at").eq("event_id", event.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user && event.host_id ? admin.from("host_reviews").select("id,rating,body,status,created_at,updated_at").eq("event_id", event.id).eq("host_id", event.host_id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const published = reviews || [];
  const ratingTotal = published.reduce((sum, review) => sum + review.rating, 0);
  return NextResponse.json({
    reviews: published,
    summary: { count: published.length, average: published.length ? Number((ratingTotal / published.length).toFixed(1)) : 0 },
    canReview: Boolean(user && ticketResult.count && event.ends_at && new Date(event.ends_at).getTime() < Date.now()),
    ownReview: ownResult.data || null,
    ownHostReview: ownHostResult.data || null,
    authenticated: Boolean(user),
  });
}

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const event = await resolveEvent(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string; reviewId?: string; rating?: number; body?: string; hostRating?: number; hostBody?: string; reason?: string } | null;
  const admin = createAdminClient();
  if (body?.action === "report") {
    const reason = String(body.reason || "Inappropriate or misleading review").trim().slice(0, 500);
    const { data: review } = await admin.from("event_reviews").select("id,user_id").eq("id", body.reviewId || "").eq("event_id", event.id).eq("status", "published").maybeSingle();
    if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });
    if (review.user_id === user.id) return NextResponse.json({ error: "You cannot report your own review" }, { status: 400 });
    const { error } = await admin.from("event_review_reports").upsert({ review_id: review.id, reporter_id: user.id, reason, status: "open" }, { onConflict: "review_id,reporter_id" });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ reported: true });
  }
  const rating = Number(body?.rating);
  const reviewBody = String(body?.body || "").trim();
  const hostRating = Number(body?.hostRating);
  const hostBody = String(body?.hostBody || "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Choose a rating from 1 to 5" }, { status: 400 });
  if (reviewBody.length < 5 || reviewBody.length > 1500) return NextResponse.json({ error: "Review must be between 5 and 1500 characters" }, { status: 400 });
  if (body?.hostRating !== undefined && (!Number.isInteger(hostRating) || hostRating < 1 || hostRating > 5)) return NextResponse.json({ error: "Choose a host rating from 1 to 5" }, { status: 400 });
  if (body?.hostRating !== undefined && (hostBody.length < 5 || hostBody.length > 1500)) return NextResponse.json({ error: "Host review must be between 5 and 1500 characters" }, { status: 400 });
  const { count } = await admin.from("tickets").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("owner_id", user.id).in("status", ["valid", "used"]);
  if (!count || !event.ends_at || new Date(event.ends_at).getTime() >= Date.now()) return NextResponse.json({ error: "You can review this event after it has ended" }, { status: 403 });
  const now = new Date().toISOString();
  const { data, error } = await admin.from("event_reviews").upsert({ event_id: event.id, user_id: user.id, rating, body: reviewBody, status: "published", verified_at: now, updated_at: now }, { onConflict: "event_id,user_id" }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (body?.hostRating !== undefined && event.host_id) {
    const { error: hostError } = await admin.from("host_reviews").upsert({ host_id: event.host_id, event_id: event.id, user_id: user.id, rating: hostRating, body: hostBody, status: "published", verified_at: now, updated_at: now }, { onConflict: "host_id,event_id,user_id" });
    if (hostError) return NextResponse.json({ error: hostError.message }, { status: 400 });
  }
  return NextResponse.json({ saved: true, id: data.id });
}

export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  const event = await resolveEvent(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const admin = createAdminClient();
  const [{ error }, { error: hostError }] = await Promise.all([
    admin.from("event_reviews").delete().eq("event_id", event.id).eq("user_id", user.id),
    admin.from("host_reviews").delete().eq("event_id", event.id).eq("user_id", user.id),
  ]);
  return error || hostError ? NextResponse.json({ error: error?.message || hostError?.message }, { status: 400 }) : NextResponse.json({ deleted: true });
}
