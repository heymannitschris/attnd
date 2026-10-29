import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

async function currentUser() {
  const supabase = await createClient();
  return (await supabase.auth.getUser()).data.user;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("local_memberships")
    .select("id,locality,status,verified_at,expires_at,proof_original_name,review_note,submitted_at,updated_at")
    .eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ membership: data || null });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const locality = String(form?.get("locality") || "").trim().slice(0, 100);
  const proof = form?.get("proof");
  if (locality.length < 2) return NextResponse.json({ error: "Enter your city or local area" }, { status: 400 });
  if (!(proof instanceof File) || !proof.size) return NextResponse.json({ error: "Upload proof of residence" }, { status: 400 });
  if (proof.size > 8 * 1024 * 1024) return NextResponse.json({ error: "The document must be smaller than 8 MB" }, { status: 400 });
  if (!allowedTypes.has(proof.type)) return NextResponse.json({ error: "Use a JPG, PNG, WebP or PDF document" }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from("local_memberships").select("status,proof_storage_path").eq("user_id", user.id).maybeSingle();
  if (existing?.status === "verified") return NextResponse.json({ error: "Your Local Membership is already verified" }, { status: 409 });
  const extension = proof.type === "application/pdf" ? "pdf" : proof.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await proof.arrayBuffer());
  const { error: uploadError } = await admin.storage.from("local-membership-proofs").upload(path, bytes, { contentType: proof.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
  const now = new Date().toISOString();
  const { error } = await admin.from("local_memberships").upsert({
    user_id: user.id,
    locality,
    status: "pending",
    proof_storage_path: path,
    proof_original_name: proof.name.slice(0, 180),
    proof_mime_type: proof.type,
    review_note: "",
    submitted_at: now,
    updated_at: now,
    verified_by: null,
    verified_at: null,
    rejected_at: null,
  }, { onConflict: "user_id" });
  if (error) {
    await admin.storage.from("local-membership-proofs").remove([path]);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (existing?.proof_storage_path && existing.proof_storage_path !== path) await admin.storage.from("local-membership-proofs").remove([existing.proof_storage_path]);
  return NextResponse.json({ submitted: true });
}
