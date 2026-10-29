"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { canPerformAdminAction } from "@/lib/admin-permissions";

type Props = {
  orderId: string;
  paymentCaseStatus?: string | null;
  refundId?: string | null;
  refundStatus?: string | null;
  canRefund: boolean;
  role: string;
};

export function AdminOrderActions({ orderId, paymentCaseStatus, refundId, refundStatus, canRefund, role }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  async function act(action: string, targetId: string) {
    let note = "";
    if (action === "reject-refund" || action === "needs-info-refund") {
      const answer = window.prompt(action === "reject-refund" ? "Reason for declining this refund" : "What information is needed?");
      if (answer === null) return;
      note = answer;
    }
    if (action === "approve-refund" && !window.confirm("Refund this order through Stripe? This also invalidates its tickets.")) return;
    setBusy(action); setNotice("");
    const response = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, targetId, note }) });
    const result = await response.json() as { error?: string };
    setBusy("");
    setNotice(response.ok ? "Order updated." : result.error || "Admin action failed.");
    if (response.ok) router.refresh();
  }

  const refundOpen = refundId && (refundStatus === "open" || refundStatus === "needs_info");
  const caseOpen = paymentCaseStatus !== "resolved" && paymentCaseStatus !== "ignored";
  return <section className="admin-order-actions">
    <div><span>ADMIN ACTIONS</span><h2>Resolve this order</h2></div>
    <div>
      {caseOpen && canPerformAdminAction(role,"resolve-payment") && <><button type="button" disabled={Boolean(busy)} onClick={() => void act("resolve-payment", orderId)}>Mark payment resolved</button><button type="button" disabled={Boolean(busy)} onClick={() => void act("ignore-payment", orderId)}>Ignore payment issue</button></>}
      {refundOpen && canRefund && canPerformAdminAction(role,"approve-refund") && <button className="danger" type="button" disabled={Boolean(busy)} onClick={() => void act("approve-refund", refundId)}>Approve refund</button>}
      {refundOpen && canPerformAdminAction(role,"needs-info-refund") && <><button type="button" disabled={Boolean(busy)} onClick={() => void act("needs-info-refund", refundId)}>Request information</button><button className="danger-outline" type="button" disabled={Boolean(busy)} onClick={() => void act("reject-refund", refundId)}>Decline refund</button></>}
      {(!caseOpen && !refundOpen || !canPerformAdminAction(role,"resolve-payment") && !canPerformAdminAction(role,"approve-refund")) && <p>No available action for your admin role.</p>}
    </div>
    {notice && <p role="status">{notice}</p>}
  </section>;
}
