import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { orderId?: string; reason?: string } | null;
  const reason = String(body?.reason || "").trim().slice(0, 1000);
  if (!body?.orderId || reason.length < 5) return NextResponse.json({ error: "Tell us why you are requesting a refund" }, { status: 400 });
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id,payment_status").eq("id", body.orderId).eq("buyer_id", user.id).maybeSingle();
  if (!order || order.payment_status !== "paid") return NextResponse.json({ error: "This order is not eligible for a refund request" }, { status: 409 });
  const { error } = await admin.from("refund_requests").upsert({ order_id: order.id, requester_id: user.id, reason, status: "open", resolution_note: "", reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString() }, { onConflict: "order_id" });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ submitted: true });
}
