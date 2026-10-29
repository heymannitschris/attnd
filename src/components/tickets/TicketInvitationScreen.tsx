"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";
import { mockTickets } from "@/lib/mock-tickets";

const ticket = mockTickets[0];

export function TicketInvitationScreen() {
  const [accepted, setAccepted] = useState(false);
  const [notice, setNotice] = useState("");

  if (accepted) return <TicketAddedScreen />;

  return <div className="ticket-invitation-screen">
    <header className="ticket-invitation-header"><Link href="/notifications" aria-label="Back to notifications"><DiscoverIcon name="chevron" /></Link><h1>Ticket Invitation</h1></header>
    <section className="ticket-invitation-intro"><div className="ticket-invitation-sender"><Avatar name="Chris Mann" portrait={0} size={86} /><span><DiscoverIcon name="ticket" /></span><i /><i /><i /><i /></div><h2>Chris Mann sent you<br />a ticket!</h2><p>You’ve been invited to attend this event.<br />Accept the ticket to add it to your account.</p></section>
    <TicketInvitationCard />
    <div className="ticket-invitation-actions"><button type="button" onClick={() => { setAccepted(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Accept Ticket</button><button type="button" onClick={() => setNotice("Ticket invitation declined")}>Decline</button></div>
    <p className="ticket-invitation-expiry">This invitation will expire in 7 days.</p>
    {notice && <button type="button" className="transfer-notice" onClick={() => setNotice("")}>{notice}</button>}
  </div>;
}

function TicketInvitationCard() {
  return <section className="ticket-invitation-card">
    <div className="ticket-invitation-event"><Image src={ticket.image} alt={ticket.imageAlt} fill sizes="(max-width: 672px) 100vw, 620px" className="object-cover" /><span /><div><h2>{ticket.title}</h2><p><DiscoverIcon name="calendar" />{ticket.date} · {ticket.time}</p><p><DiscoverIcon name="pin" />{ticket.location}</p><p><DiscoverIcon name="ticket" />{ticket.ticketType}</p></div></div>
    <div className="ticket-invitation-from"><Avatar name="Chris Mann" portrait={0} size={48} /><p><small>From</small><strong>Chris Mann</strong><span>@chrismann</span></p><blockquote>Hope you enjoy the event! 🙌</blockquote></div>
    <div className="ticket-invitation-info"><span><DiscoverIcon name="ticket" /></span><p>This ticket will be added to your account after you accept it.</p></div>
  </section>;
}

function TicketAddedScreen() {
  return <div className="ticket-added-screen">
    <Link href="/tickets" aria-label="Close" className="ticket-added-close"><DiscoverIcon name="x" /></Link>
    <div className="transfer-success-mark" aria-hidden="true"><i /><i /><i /><i /><i /><span><DiscoverIcon name="check" /></span></div>
    <h1>Ticket Added!</h1><p>You’ve successfully received the ticket.<br />See you at the event! 🎉</p>
    <TicketInvitationCard />
    <div className="ticket-added-account"><span><DiscoverIcon name="ticket" /></span><p><strong>Your ticket is now in your account</strong><small>You can find it in “My Tickets” and use it at the event with your QR code.</small></p></div>
    <Link href="/tickets" className="ticket-added-primary">View My Ticket <DiscoverIcon name="arrow" /></Link><Link href="/explore" className="ticket-added-secondary">Explore More Events</Link>
    <Link href={`/events/${ticket.eventId}`} className="transfer-go-together"><span><DiscoverIcon name="users" /></span><p><strong>Going with friends?</strong><small>See who else is attending and connect.</small></p><em>View Attendees <DiscoverIcon name="chevron" /></em></Link>
  </div>;
}
