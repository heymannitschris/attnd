import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUsers } from "@/lib/notify";
import { escapeHtml, sendEmail } from "@/lib/email";

async function actor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function hostedEvent(userId: string, eventId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("events").select("id,title,slug,city,host_id").eq("id", eventId).maybeSingle();
  return data?.host_id === userId ? data : null;
}

export async function GET(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const eventId = new URL(request.url).searchParams.get("eventId") || "";
  const event = await hostedEvent(user.id, eventId);
  if (!event) return NextResponse.json({ error: "Only the host can manage event access" }, { status: 403 });
  const admin = createAdminClient();
  const [{ data: guestlist, error }, { data: rule }] = await Promise.all([
    admin.from("event_guestlist_entries").select("id,user_id,guest_name,guest_email,plus_ones,notes,status,arrived_at,created_at,profiles!event_guestlist_entries_user_id_fkey(username,avatar_url)").eq("event_id", eventId).order("guest_name"),
    admin.from("event_local_access_rules").select("enabled,locality,benefit_type,discount_percent,capacity,redeemed_count").eq("event_id", eventId).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const locality = rule?.locality || event.city || "";
  const { data: locals } = locality ? await admin.from("local_memberships").select("id,user_id,locality,status,verified_at,submitted_at,proof_storage_path,proof_original_name,review_note,profiles!local_memberships_user_id_fkey(first_name,username,avatar_url)").ilike("locality", locality).order("submitted_at", { ascending: false }) : { data: [] };
  const localsWithProof = await Promise.all((locals || []).map(async (member) => {
    const proofUrl = member.proof_storage_path ? (await admin.storage.from("local-membership-proofs").createSignedUrl(member.proof_storage_path, 600)).data?.signedUrl || null : null;
    return { ...member, proof_storage_path: undefined, proof_url: proofUrl };
  }));
  return NextResponse.json({ guestlist: guestlist || [], localRule: rule || null, locals: localsWithProof, suggestedLocality: event.city || "" });
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string; eventId?: string; username?: string; name?: string; email?: string; plusOnes?: number; notes?: string; locality?: string; benefitType?: "free" | "percentage"; discountPercent?: number; capacity?: number | null; enabled?: boolean } | null;
  if (!body?.eventId) return NextResponse.json({ error: "Event is required" }, { status: 400 });
  const event = await hostedEvent(user.id, body.eventId);
  if (!event) return NextResponse.json({ error: "Only the host can manage event access" }, { status: 403 });
  const admin = createAdminClient();
  if (body.action === "guest") {
    const username = body.username?.trim().replace(/^@/, "");
    const { data: person } = username ? await admin.from("profiles").select("id,first_name,username").ilike("username", username).maybeSingle() : { data: null };
    const name = (body.name?.trim() || person?.first_name || person?.username || "").slice(0, 100);
    const email = body.email?.trim().toLowerCase() || null;
    if (name.length < 2 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return NextResponse.json({ error: "Enter a guest name and a valid optional email" }, { status: 400 });
    const { data: pass, error } = await admin.from("event_guestlist_entries").insert({ event_id: event.id, created_by: user.id, user_id: person?.id || null, guest_name: name, guest_email: email, plus_ones: Math.max(0, Math.min(10, Math.round(Number(body.plusOnes) || 0))), notes: String(body.notes || "").slice(0, 500) }).select("id").single();
    if (error) return NextResponse.json({ error: error.code === "23505" ? "This member is already on the guestlist" : error.message }, { status: 400 });
    if (person?.id) await notifyUsers([person.id], { category: "Events", title: `You’re on the guestlist for ${event.title}`, body: "Your Guestlist Pass and QR code are ready.", href: "/tickets?tab=Guestlist", preference: "updates" });
    let inviteEmail = email;
    if (!inviteEmail && person?.id) inviteEmail = (await admin.auth.admin.getUserById(person.id)).data.user?.email || null;
    let emailSent: boolean | undefined;
    if (inviteEmail) {
      const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
      const result = await sendEmail({ to: inviteEmail, subject: `You’re on the guestlist for ${event.title}`, html: `<h1>You’re on the guestlist</h1><p>${escapeHtml(name)}, the host added you to <strong>${escapeHtml(event.title)}</strong>${Number(body.plusOnes) > 0 ? ` with ${Math.round(Number(body.plusOnes))} plus-one${Number(body.plusOnes) === 1 ? "" : "s"}` : ""}.</p><p>Your Guestlist Pass and QR code are ready in Attnd.</p><p><a href="${origin}/tickets?tab=Guestlist">Open your Guestlist Pass</a></p>` });
      emailSent = result.sent;
    }
    return NextResponse.json({ created: true, passId: pass?.id, emailSent });
  }
  if (body.action === "rule") {
    const locality = String(body.locality || event.city || "").trim().slice(0, 100);
    const type = body.benefitType === "free" ? "free" : "percentage";
    const percent = type === "free" ? 100 : Math.max(1, Math.min(99, Math.round(Number(body.discountPercent) || 0)));
    if (locality.length < 2) return NextResponse.json({ error: "Enter the city or local area" }, { status: 400 });
    const capacity = body.capacity == null || Number(body.capacity) <= 0 ? null : Math.round(Number(body.capacity));
    const { error } = await admin.from("event_local_access_rules").upsert({ event_id: event.id, enabled: body.enabled !== false, locality, benefit_type: type, discount_percent: percent, capacity, updated_at: new Date().toISOString() }, { onConflict: "event_id" });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ saved: true });
  }
  if (body.action === "local") {
    const username = body.username?.trim().replace(/^@/, "").toLowerCase() || "";
    const locality = String(body.locality || event.city || "").trim().slice(0, 100);
    const { data: person } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
    if (!person || locality.length < 2) return NextResponse.json({ error: "Member account or locality not found" }, { status: 404 });
    const { error } = await admin.from("local_memberships").upsert({ user_id: person.id, locality, status: "verified", verified_by: user.id, verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await notifyUsers([person.id], { category: "Events", title: "Local membership verified", body: `You can now use local benefits for events in ${locality}.`, href: `/events/${event.slug}`, preference: "updates" });
    return NextResponse.json({ verified: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { eventId?: string; guestId?: string; status?: "invited" | "arrived" | "cancelled"; membershipId?: string; membershipStatus?: "verified" | "rejected"; reviewNote?: string } | null;
  if (!body?.eventId) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  const event = await hostedEvent(user.id, body.eventId);
  if (!event) return NextResponse.json({ error: "Only the host can manage event access" }, { status: 403 });
  const admin = createAdminClient();
  if (body.membershipId && ["verified", "rejected"].includes(body.membershipStatus || "")) {
    const [{ data: membership }, { data: rule }] = await Promise.all([
      admin.from("local_memberships").select("id,user_id,locality,status").eq("id", body.membershipId).maybeSingle(),
      admin.from("event_local_access_rules").select("locality").eq("event_id", event.id).maybeSingle(),
    ]);
    const expectedLocality = rule?.locality || event.city || "";
    if (!membership || !expectedLocality || membership.locality.toLowerCase() !== expectedLocality.toLowerCase()) return NextResponse.json({ error: "This application does not match the event's local area" }, { status: 400 });
    const verified = body.membershipStatus === "verified";
    const { error } = await admin.from("local_memberships").update({ status: body.membershipStatus, verified_by: verified ? user.id : null, verified_at: verified ? new Date().toISOString() : null, rejected_at: verified ? null : new Date().toISOString(), review_note: String(body.reviewNote || "").slice(0, 500), updated_at: new Date().toISOString() }).eq("id", membership.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await notifyUsers([membership.user_id], { category: "Events", title: verified ? "Local Membership approved" : "Local Membership needs an update", body: verified ? `Your Local Badge for ${membership.locality} is active.` : "Review the note and submit a new proof of residence.", href: "/profile/local-membership", preference: "updates" });
    return NextResponse.json({ updated: true });
  }
  if (!body.guestId || !["invited", "arrived", "cancelled"].includes(body.status || "")) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  const { error } = await admin.from("event_guestlist_entries").update({ status: body.status, arrived_at: body.status === "arrived" ? new Date().toISOString() : null }).eq("id", body.guestId).eq("event_id", body.eventId);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ updated: true });
}

export async function DELETE(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId") || "";
  const guestId = url.searchParams.get("guestId") || "";
  if (!await hostedEvent(user.id, eventId)) return NextResponse.json({ error: "Only the host can manage event access" }, { status: 403 });
  const admin = createAdminClient();
  const { error } = await admin.from("event_guestlist_entries").delete().eq("id", guestId).eq("event_id", eventId);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ deleted: true });
}
