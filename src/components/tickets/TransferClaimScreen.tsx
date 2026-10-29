"use client";

import Link from "next/link";
import { useState } from "react";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";

export function TransferClaimScreen({ token }: { token: string }) {
  const [state, setState] = useState<"ready" | "loading" | "done" | "error">(token ? "ready" : "error");
  const [message, setMessage] = useState(token ? "Accept the transfer to add this ticket to My Tickets." : "This transfer link is invalid.");
  const accept = async () => {
    setState("loading");
    const response = await fetch("/api/tickets/transfer", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(result.error || "The ticket could not be transferred."); setState("error"); return; }
    setMessage("The ticket is now in your account."); setState("done");
  };
  return <main className="ticket-invitation-screen"><header className="ticket-invitation-header"><Link href="/tickets" aria-label="Back"><DiscoverIcon name="chevron" /></Link><h1>Ticket Transfer</h1><span /></header><section className="ticket-invitation-intro"><span className="transfer-success-mark"><DiscoverIcon name={state === "done" ? "check" : "ticket"} /></span><h2>{state === "done" ? "Ticket accepted" : "A ticket is waiting for you"}</h2><p>{message}</p></section>{state === "ready" || state === "loading" ? <button type="button" disabled={state === "loading"} className="transfer-success-primary" onClick={() => void accept()}>{state === "loading" ? "Accepting…" : "Accept Ticket"}</button> : <Link className="transfer-success-primary" href="/tickets">View My Tickets</Link>}</main>;
}
