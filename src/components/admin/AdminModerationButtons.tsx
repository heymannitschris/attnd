"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { canPerformAdminAction } from "@/lib/admin-permissions";

export function AdminModerationButtons({ targetId, targetType, suspended, role }: { targetId: string; targetType: "user" | "event"; suspended: boolean; role: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function update() {
    const action = suspended ? `restore-${targetType}` : `suspend-${targetType}`;
    let note = "";
    if (!suspended) { const answer = window.prompt(`Reason for suspending this ${targetType}`); if (answer === null) return; note = answer; }
    if (!window.confirm(`${suspended ? "Restore" : "Suspend"} this ${targetType}?`)) return;
    setBusy(true); setNotice("");
    const response = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, targetId, note }) });
    const result = await response.json() as { error?: string };
    setBusy(false); setNotice(response.ok ? `${targetType === "user" ? "User" : "Event"} updated.` : result.error || "Update failed.");
    if (response.ok) router.refresh();
  }
  const action = suspended ? `restore-${targetType}` : `suspend-${targetType}`;
  if (!canPerformAdminAction(role, action)) return null;
  return <div className="admin-detail-actions"><button type="button" className={suspended ? "" : "danger"} disabled={busy} onClick={() => void update()}>{busy ? "Working…" : suspended ? `Restore ${targetType}` : `Suspend ${targetType}`}</button>{notice && <span role="status">{notice}</span>}</div>;
}
