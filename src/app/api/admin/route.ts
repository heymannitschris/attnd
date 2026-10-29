import { NextResponse } from "next/server";
import { getAdminActor } from "@/lib/admin-auth";
import { createStripe } from "@/lib/stripe";
import { notifyUsers } from "@/lib/notify";
import { canPerformAdminAction } from "@/lib/admin-permissions";
import { promoteWaitlistsForOrder } from "@/lib/waitlist";

export async function POST(request: Request) {
  const actor = await getAdminActor();
  if (!actor) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = String(body?.action || "");
  const targetId = String(body?.targetId || "");
  const note = String(body?.note || "").trim().slice(0, 1000);
  if (!targetId) return NextResponse.json({ error: "Target is required" }, { status: 400 });
  const { admin, user } = actor;
  if (!canPerformAdminAction(actor.role, action)) return NextResponse.json({ error: "Your admin role cannot perform this action" }, { status: 403 });
  let auditType = "unknown";

  if (action === "suspend-user" || action === "restore-user") {
    if (targetId === user.id) return NextResponse.json({ error: "You cannot suspend your own admin account" }, { status: 400 });
    const suspended = action === "suspend-user";
    const { error } = await admin.from("profiles").update({ account_status: suspended ? "suspended" : "active", suspended_at: suspended ? new Date().toISOString() : null, suspended_by: suspended ? user.id : null, suspension_reason: suspended ? note || "Suspended by Attnd administration" : "", updated_at: new Date().toISOString() }).eq("id", targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const authResult = await admin.auth.admin.updateUserById(targetId, { ban_duration: suspended ? "876000h" : "none" });
    if (authResult.error) return NextResponse.json({ error: authResult.error.message }, { status: 400 });
    auditType = "user";
  } else if (action === "suspend-event" || action === "restore-event") {
    const suspended = action === "suspend-event";
    const { error } = await admin.from("events").update({ admin_suspended: suspended, admin_suspended_at: suspended ? new Date().toISOString() : null, admin_suspended_by: suspended ? user.id : null, admin_suspension_reason: suspended ? note || "Suspended by Attnd administration" : "", updated_at: new Date().toISOString() }).eq("id", targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    auditType = "event";
  } else if (action === "approve-local" || action === "reject-local") {
    const approved = action === "approve-local";
    const { data: membership, error } = await admin.from("local_memberships").update({ status: approved ? "verified" : "rejected", verified_by: approved ? user.id : null, verified_at: approved ? new Date().toISOString() : null, rejected_at: approved ? null : new Date().toISOString(), review_note: note, updated_at: new Date().toISOString() }).eq("id", targetId).select("user_id,locality").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await notifyUsers([membership.user_id], { category: "Events", title: approved ? "Local Membership approved" : "Local Membership needs an update", body: approved ? `Your Local Badge for ${membership.locality} is active.` : note || "Please upload an updated proof of residence.", href: "/profile/local-membership", preference: "updates" });
    auditType = "local_membership";
  } else if (action === "hide-report" || action === "dismiss-report") {
    const { data: report, error } = await admin.from("event_live_moment_reports").update({ status: action === "hide-report" ? "reviewed" : "dismissed" }).eq("id", targetId).select("moment_id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (action === "hide-report") await admin.from("event_live_moments").update({ status: "hidden" }).eq("id", report.moment_id);
    auditType = "report";
  } else if (action === "hide-review-report" || action === "dismiss-review-report") {
    const actioned = action === "hide-review-report";
    const { data: report, error } = await admin.from("event_review_reports").update({ status: actioned ? "actioned" : "dismissed" }).eq("id", targetId).select("review_id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (actioned) await admin.from("event_reviews").update({ status: "hidden", updated_at: new Date().toISOString() }).eq("id", report.review_id);
    auditType = "review_report";
  } else if (action === "approve-refund" || action === "reject-refund" || action === "needs-info-refund") {
    const { data: refund } = await admin.from("refund_requests").select("id,requester_id,order_id,orders(payment_status,stripe_payment_intent_id,events(title))").eq("id", targetId).maybeSingle();
    if (!refund) return NextResponse.json({ error: "Refund request not found" }, { status: 404 });
    const order = refund.orders as unknown as { payment_status: string; stripe_payment_intent_id: string | null; events: { title?: string } | null };
    let status = action === "reject-refund" ? "rejected" : action === "needs-info-refund" ? "needs_info" : "approved";
    if (action === "approve-refund") {
      if (order.payment_status !== "paid" || !order.stripe_payment_intent_id) return NextResponse.json({ error: "This order cannot be refunded through Stripe" }, { status: 409 });
      try { await createStripe().refunds.create({ payment_intent: order.stripe_payment_intent_id, metadata: { attnd_refund_request_id: refund.id } }, { idempotencyKey: `attnd-refund-${refund.id}` }); }
      catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Stripe refund failed" }, { status: 502 }); }
      const reversed = await admin.rpc("reverse_paid_order", { p_order_id: refund.order_id });
      if (reversed.error) return NextResponse.json({ error: reversed.error.message }, { status: 500 });
      await promoteWaitlistsForOrder(refund.order_id);
    }
    await admin.from("refund_requests").update({ status, resolution_note: note, reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", targetId);
    await notifyUsers([refund.requester_id], { category: "Tickets", title: status === "approved" ? "Refund approved" : status === "rejected" ? "Refund request declined" : "More information needed", body: note || (status === "approved" ? "The refund was sent to your original payment method." : "Open your refund request for details."), href: "/tickets?tab=Cancelled", preference: "updates" });
    auditType = "refund";
  } else if (action === "resolve-payment" || action === "ignore-payment") {
    const status = action === "resolve-payment" ? "resolved" : "ignored";
    const { error } = await admin.from("admin_payment_cases").upsert({ order_id: targetId, status, note, reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "order_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    auditType = "payment";
  } else return NextResponse.json({ error: "Unknown admin action" }, { status: 400 });

  await admin.from("admin_audit_log").insert({ admin_user_id: user.id, action, target_type: auditType, target_id: targetId, note });
  return NextResponse.json({ updated: true });
}
