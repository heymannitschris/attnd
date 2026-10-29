"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";
import { buildAffiliateEventUrl } from "@/lib/affiliate-links";
import { mockTickets, transferRecipients } from "@/lib/mock-tickets";
import type { TransferRecipient } from "@/types/app-ticket";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

const ticket = mockTickets[0];

export function TransferTicketScreen({ ticketId }: { ticketId?: string }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selected, setSelected] = useState<TransferRecipient | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("Hope you enjoy the event! 🙌");
  const [notice, setNotice] = useState("");
  const [alternative, setAlternative] = useState<"email" | "link" | null>(null);
  const [transferEmail, setTransferEmail] = useState("");
  const [resolvedTicketId, setResolvedTicketId] = useState(ticketId || "");
  const [databaseRecipients, setDatabaseRecipients] = useState<TransferRecipient[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const affiliateUrl = buildAffiliateEventUrl("https://www.attnd.space", ticket.eventId);
  const recipients = useMemo(() => (databaseRecipients ?? transferRecipients).filter((person) => `${person.name} ${person.handle}`.toLowerCase().includes(query.toLowerCase())), [databaseRecipients, query]);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    void fetch("/api/profiles").then((response) => response.json()).then((result: { profiles?: Array<{ id: string; first_name: string | null; username: string | null }> }) => {
      if (result.profiles) setDatabaseRecipients(result.profiles.map((profile, index) => ({ id: profile.id, name: profile.first_name || profile.username || "Attnd member", handle: profile.username ? `@${profile.username}` : "Attnd member", portrait: index % 4, online: false })));
    });
    if (!ticketId) void createClient().from("tickets").select("id").eq("status", "valid").order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => { if (data?.id) setResolvedTicketId(data.id); });
  }, [ticketId]);

  async function createTransfer(input: { recipientId?: string; email?: string }) {
    if (!resolvedTicketId) { setNotice("Choose a valid ticket from My Tickets first."); return false; }
    setSubmitting(true); setNotice("");
    try {
      const response = await fetch("/api/tickets/transfer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ticketId: resolvedTicketId, message, ...input }) });
      const result = await response.json() as { error?: string; emailSent?: boolean };
      if (!response.ok) throw new Error(result.error || "Ticket transfer failed");
      if (input.email && result.emailSent === false) setNotice("Transfer created, but email delivery is not configured.");
      return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : "Ticket transfer failed"); return false; }
    finally { setSubmitting(false); }
  }

  function choose(person: TransferRecipient) { setSelected(person); setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function back() { if (step === 4) setStep(3); else if (step > 1) setStep((step - 1) as 1 | 2); }

  return <div className="transfer-ticket-screen">
    <header className="transfer-header">{step === 1 || step === 4 ? <Link href="/tickets" aria-label="Back to tickets"><DiscoverIcon name="chevron" /></Link> : <button type="button" aria-label="Previous step" onClick={back}><DiscoverIcon name="chevron" /></button>}<h1>{step === 4 ? "Ticket Transferred" : "Transfer Ticket"}</h1></header>
    {step === 1 && <TransferEventSummary />}
    {step < 4 && <TransferSteps step={step as 1 | 2 | 3} />}
    {step > 1 && step < 4 && <TransferEventSummary />}

    {step === 1 && <section className="transfer-recipient-panel"><h2>Choose Someone on the App</h2><p>Send your ticket to someone you follow or search for a user.</p><label className="transfer-search"><DiscoverIcon name="search" /><input aria-label="Search recipients" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or @username..." /></label>
      <div className="transfer-divider"><span>Or send via</span></div><div className="transfer-alternatives"><button type="button" aria-expanded={alternative === "email"} onClick={() => setAlternative(alternative === "email" ? null : "email")}><span>✉</span><p><strong>Send via Email</strong><small>To a friend outside the app</small></p><DiscoverIcon name="chevron" /></button><button type="button" aria-expanded={alternative === "link"} onClick={() => setAlternative(alternative === "link" ? null : "link")}><span>🔗</span><p><strong>Share Link</strong><small>Use your affiliate link</small></p><DiscoverIcon name="chevron" /></button></div>
      {alternative === "email" && <form className="transfer-alternative-box" onSubmit={async (event) => { event.preventDefault(); if (!transferEmail) return; const recipient = transferEmail; if (await createTransfer({ email: recipient })) { setTransferEmail(""); setAlternative(null); setNotice(`Ticket transfer created for ${recipient}`); } }}><div><strong>Send ticket by email</strong><button type="button" onClick={() => setAlternative(null)} aria-label="Close email form">×</button></div><p>Enter the recipient’s email address. They’ll receive the ticket invitation and your message.</p><label><DiscoverIcon name="send" /><input type="email" required value={transferEmail} onChange={(event) => setTransferEmail(event.target.value)} placeholder="friend@example.com" /></label><button type="submit" disabled={submitting}>{submitting ? "Sending…" : "Send Transfer Email"}</button></form>}
      {alternative === "link" && <section className="transfer-alternative-box"><div><strong>Your affiliate transfer link</strong><button type="button" onClick={() => setAlternative(null)} aria-label="Close share link">×</button></div><p>Share this link. Ticket sales from it are connected to your affiliate account.</p><label className="transfer-affiliate-link"><input readOnly value={affiliateUrl} aria-label="Affiliate transfer link" /><button type="button" onClick={async () => { await navigator.clipboard.writeText(affiliateUrl); setNotice("Affiliate link copied"); }}>Copy</button></label></section>}
      <RecipientGroup title="Following" people={recipients.slice(0, 5)} onChoose={choose} onSeeAll={() => setNotice("All following shown")} />
      <RecipientGroup title="Suggested" people={recipients.slice(5)} onChoose={choose} onSeeAll={() => setNotice("All suggestions shown")} />
    </section>}

    {step === 2 && selected && <section className="transfer-details transfer-details-step-two"><div className="transfer-section-heading"><h2>Selected Recipient</h2><button type="button" onClick={() => setStep(1)}>Change</button></div><RecipientCard person={selected} /><label className="transfer-message"><span><strong>Add a Message</strong> (optional)<small>{message.length}/200</small></span><textarea maxLength={200} value={message} onChange={(event) => setMessage(event.target.value)} /></label><div className="transfer-info"><span>•••</span><p>{selected.name.split(" ")[0]} will receive a notification and needs to accept the ticket before the transfer is completed.</p></div><h2 className="transfer-ticket-summary-title">Ticket Summary</h2><TicketSummary /><button type="button" className="transfer-primary transfer-next-fixed" onClick={() => { setStep(3); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Next <DiscoverIcon name="arrow" /></button></section>}

    {step === 3 && selected && <section className="transfer-confirm transfer-confirm-fixed"><div className="transfer-section-heading"><h2>Recipient</h2><button type="button" onClick={() => setStep(1)}>Edit</button></div><RecipientCard person={selected} /><div className="transfer-section-heading transfer-message-heading"><h2>Message <small>(optional)</small></h2><button type="button" onClick={() => setStep(2)}>Edit</button></div><p className="transfer-message-preview">{message}</p><div className="transfer-section-heading"><h2>Ticket Summary</h2><button type="button" onClick={() => setStep(2)}>Edit</button></div><TicketSummary compact /><div className="transfer-warning"><DiscoverIcon name="shield" /><p>Once you confirm, the ticket will be transferred to {selected.name.split(" ")[0]}. They will receive a notification and need to accept the ticket.</p></div><button type="button" disabled={submitting} className="transfer-primary transfer-confirm-button-fixed" onClick={async () => { if (await createTransfer({ recipientId: selected.id })) { setStep(4); window.scrollTo({ top: 0, behavior: "smooth" }); } }}>{submitting ? "Transferring…" : "Confirm Transfer"}<DiscoverIcon name="arrow" /></button></section>}
    {step === 4 && selected && <TransferSuccess recipient={selected} onAnother={() => { setSelected(null); setStep(1); setMessage("Hope you enjoy the event! 🙌"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}
    {notice && <button type="button" className="transfer-notice" onClick={() => setNotice("")}>{notice}</button>}
  </div>;
}

function TransferSteps({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Recipient", "Details", "Confirm", "Done"];
  return <div className="transfer-steps" aria-label={`Transfer step ${step} of 4`}>{labels.map((label, index) => { const number = index + 1; const complete = number < step; const current = number === step; return <div key={label} className={complete ? "is-complete" : current ? "is-current" : ""}><span>{complete ? <DiscoverIcon name="check" /> : number}</span><small>{label}</small>{index < labels.length - 1 && <i />}</div>; })}</div>;
}

function TransferSuccess({ recipient, onAnother }: { recipient: TransferRecipient; onAnother: () => void }) {
  return <section className="transfer-success">
    <div className="transfer-success-mark" aria-hidden="true"><i /><i /><i /><i /><i /><span><DiscoverIcon name="check" /></span></div>
    <h2>Ticket Successfully Transferred!</h2><p>{recipient.name.split(" ")[0]} will receive a notification and needs to<br />accept the ticket.</p>
    <TransferEventSummary />
    <div className="transfer-parties"><div><small>From</small><span><Avatar name="Chris Mann" portrait={0} size={68} /><i><DiscoverIcon name="check" /></i></span><strong>Chris Mann</strong><em>@chrismann</em></div><DiscoverIcon name="arrow" /><div><small>To</small><span><Avatar name={recipient.name} portrait={recipient.portrait} size={68} /></span><strong>{recipient.name}</strong><em>{recipient.handle}</em></div></div>
    <div className="transfer-success-notified"><span>✉</span><p><strong>We’ve notified {recipient.name.split(" ")[0]}</strong><small>She will receive a notification in the app and an email with the ticket details.</small></p></div>
    <Link href="/tickets" className="transfer-success-primary">Back to My Tickets</Link><button type="button" className="transfer-success-secondary" onClick={onAnother}>Transfer Another Ticket</button>
    <Link href={`/events/${ticket.eventId}`} className="transfer-go-together"><span><DiscoverIcon name="users" /></span><p><strong>Go together!</strong><small>See who else is going and invite more friends.</small></p><em>View Event <DiscoverIcon name="chevron" /></em></Link>
  </section>;
}

function TransferEventSummary() {
  return <article className="transfer-event-summary"><Image src={ticket.image} alt={ticket.imageAlt} width={170} height={125} /><div><h2>{ticket.title}</h2><p><DiscoverIcon name="calendar" />{ticket.date} · {ticket.time}</p><p><DiscoverIcon name="pin" />{ticket.location}</p><p><DiscoverIcon name="ticket" />{ticket.ticketType}</p></div></article>;
}

function RecipientGroup({ title, people, onChoose, onSeeAll }: { title: string; people: readonly TransferRecipient[]; onChoose: (person: TransferRecipient) => void; onSeeAll: () => void }) {
  if (!people.length) return null;
  return <div className="transfer-recipient-group"><div><h3>{title}</h3><button type="button" onClick={onSeeAll}>See All</button></div>{people.map((person) => <div key={person.id} className="transfer-person"><span className="transfer-person-avatar"><Avatar name={person.name} portrait={person.portrait} size={44} /><i className={person.online ? "is-online" : ""} /></span><p><strong>{person.name}</strong><small>{person.handle}</small></p><button type="button" onClick={() => onChoose(person)}>Select</button></div>)}</div>;
}

function RecipientCard({ person }: { person: TransferRecipient }) {
  return <div className="transfer-selected-person"><span className="transfer-person-avatar"><Avatar name={person.name} portrait={person.portrait} size={66} /><i className={person.online ? "is-online" : ""} /></span><p><strong>{person.name}</strong><small>{person.handle}</small><em>Follows you</em></p></div>;
}

function TicketSummary({ compact = false }: { compact?: boolean }) {
  return <section className={`transfer-ticket-summary ${compact ? "is-compact" : ""}`}><div><DiscoverIcon name="ticket" /><p><strong>{ticket.ticketType}</strong><span>1 × Ticket</span></p></div><div><Image src={ticket.image} alt="" width={58} height={58} /><p><strong>{ticket.title}</strong><span>{ticket.date}</span><span>{ticket.location}</span></p></div></section>;
}
