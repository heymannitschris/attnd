"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type TargetType = "profile" | "event" | "review" | "moment";
const reasons = ["Spam or scam", "Harassment or hate", "Nudity or sexual content", "Violence or illegal activity", "Fake event or profile", "Something else"];

/**
 * Report + block entry point (App Store guideline 1.2).
 * `blockUserId` adds a "Block user" action for the author / owner of the content.
 */
export function SafetyActions({ targetType, targetId, blockUserId, label = "Report", compact = false, onBlocked }: { targetType: TargetType; targetId?: string | null; blockUserId?: string | null; label?: string; compact?: boolean; onBlocked?: (userId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function send(action: "report" | "block", reason?: string) {
    setBusy(true); setNotice("");
    const response = await fetch("/api/safety", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action === "report" ? { action, targetType, targetId, reason } : { action, targetId: blockUserId }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!response.ok) return setNotice(result.error || "Something went wrong. Please try again.");
    if (action === "block" && blockUserId) { setNotice("User blocked. You won't see their content anymore."); onBlocked?.(blockUserId); }
    else setNotice("Thanks for your report. Our team reviews every report within 24 hours.");
  }

  if (!targetId && !blockUserId) return null;
  return <div className="safety-actions" data-compact={compact || undefined}>
    <button type="button" className="safety-actions-trigger" aria-expanded={open} aria-label={compact ? "Report or block" : undefined} onClick={() => { setOpen(!open); setNotice(""); }}>{compact ? "⋯" : label}</button>
    {open && typeof document !== "undefined" && createPortal(<div className="safety-actions-backdrop" onClick={() => setOpen(false)}><div className="safety-actions-sheet" role="dialog" aria-label="Report or block" aria-modal="true" onClick={(event) => event.stopPropagation()}>
      {targetId && <><p className="safety-actions-title">Report</p>{reasons.map((reason) => <button type="button" key={reason} disabled={busy} onClick={() => void send("report", reason)}>{reason}</button>)}</>}
      {blockUserId && <button type="button" className="safety-actions-block" disabled={busy} onClick={() => { if (window.confirm("Block this user? You will no longer see their profile content, reviews or live moments.")) void send("block"); }}>Block user</button>}
      <p className="safety-actions-policy">Attnd has zero tolerance for objectionable content or abusive users. Reports are reviewed within 24 hours.</p>
      {notice && <p role="status" className="safety-actions-notice">{notice}</p>}
      <button type="button" className="safety-actions-close" onClick={() => setOpen(false)}>Close</button>
    </div></div>, document.body)}
  </div>;
}
