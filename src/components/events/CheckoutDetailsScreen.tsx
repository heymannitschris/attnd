"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { makeCheckoutAttendees } from "@/lib/mock-checkout";
import type { DiscoveryEvent } from "@/types/event";
import type { CheckoutAttendee, TicketTier } from "@/types/ticket";
import { DiscoverIcon } from "./DiscoverIcon";


export function CheckoutDetailsScreen({ event, tier, quantity }: { event: DiscoveryEvent; tier: TicketTier; quantity: number }) {
  const router = useRouter();
  const [attendees, setAttendees] = useState(() => makeCheckoutAttendees(quantity));
  const [nextId, setNextId] = useState(quantity + 1);
  const [updates, setUpdates] = useState(true);
  const [notice, setNotice] = useState("");
  const [following, setFollowing] = useState<Array<{ id: string; name: string; username: string; avatarUrl: string | null }>>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/checkout/profile", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) {
        router.replace(`/onboarding?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return null;
      }
      return response.ok ? response.json() : null;
    }).then((result: { attendee?: CheckoutAttendee; following?: Array<{ id: string; name: string; username: string; avatarUrl: string | null }> } | null) => {
      if (!active || !result) return;
      setFollowing(result.following || []);
      if (result.attendee) setAttendees((current) => current.map((person, index) => index === 0 ? { ...person, ...result.attendee, id: person.id } : person));
    }).catch(() => setNotice("Your profile details could not be loaded."));
    return () => { active = false; };
  }, [router]);

  function updateAttendee(id: number, field: "firstName" | "lastName" | "email", value: string) {
    setAttendees((current) => current.map((person) => person.id === id ? { ...person, [field]: value } : person));
  }

  function addAttendee() {
    if (attendees.length >= 10) { setNotice("You can book up to 10 tickets at a time."); return; }
    setAttendees((current) => [...current, { id: nextId, firstName: "", lastName: "", email: "" }]);
    setNextId((current) => current + 1);
    setNotice("");
  }

  function selectFollowing(attendeeId: number, person: { id: string; name: string }) {
    const parts = person.name.trim().split(/\s+/).filter(Boolean);
    setAttendees((current) => current.map((attendee) => attendee.id === attendeeId ? {
      ...attendee,
      userId: person.id,
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
      email: "",
    } : attendee));
  }

  function revealField(event: React.FocusEvent<HTMLInputElement>) {
    window.setTimeout(() => event.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" }), 120);
  }

  return <div className="checkout-screen checkout-details-screen">
    <div className="checkout-fixed-header">
      <header className="checkout-header">
        <Link href={`/events/${event.id}/tickets`} aria-label="Back to ticket selection" className="icon-button checkout-back"><DiscoverIcon name="chevron" className="h-5 w-5 rotate-90" /></Link>
        <h1>Checkout</h1>
      </header>

      <nav className="checkout-steps" aria-label="Checkout progress">
        <div className="checkout-step is-complete"><span className="checkout-step-number"><DiscoverIcon name="check" /></span><span>Tickets</span></div>
        <div className="checkout-step-line is-complete" />
        <div className="checkout-step is-current" aria-current="step"><span className="checkout-step-number">2</span><span>Details</span></div>
        <div className="checkout-step-line" />
        <div className="checkout-step"><span className="checkout-step-number">3</span><span>Payment</span></div>
      </nav>
    </div>

    <form id="checkout-details-form" className="checkout-form checkout-flow-form" onSubmit={(e) => { e.preventDefault(); window.sessionStorage.setItem(`attnd:checkout-attendees:${event.id}:${tier.id}`, JSON.stringify(attendees.map(({ firstName, lastName, email }) => ({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() })))); router.push(`/events/${event.id}/checkout/payment?tier=${tier.id}&quantity=${attendees.length}`); }}>
      <div className="checkout-scroll-content">
        <section className="checkout-event" aria-label="Selected event">
        <div className="checkout-event-image"><Image src={event.image} alt={event.imageAlt} fill priority sizes="(max-width: 672px) 110px, 160px" className="object-cover" /></div>
        <div className="checkout-event-info">
          <p className="checkout-event-date">{event.date.replace("Saturday", "Sat").replace("Sunday", "Sun").replace("Friday", "Fri").toUpperCase()} · {event.time}</p>
          <h2>{event.title}</h2>
          <p className="checkout-event-location"><DiscoverIcon name="pin" />{event.location}</p>
          <p className="checkout-event-people"><DiscoverIcon name="users" /><span>{event.attendeeCount} people are going</span></p>
          <div className="checkout-event-tags">{event.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </div>
      </section>
      <section className="checkout-panel" aria-labelledby="attendee-heading">
        <h2 id="attendee-heading">Attendee Information</h2>
        <p className="checkout-panel-intro">Enter the details for each attendee.</p>
        <div className="checkout-attendee-list">
          {attendees.map((person: CheckoutAttendee, index) => <div key={person.id} className="checkout-attendee-card">
            <div className="checkout-attendee-heading"><span className="checkout-attendee-number">{index + 1}</span><strong>{[person.firstName, person.lastName].filter(Boolean).join(" ") || `Attendee ${index + 1}`}</strong>{index === 0 ? <span className="checkout-main-badge">Main Attendee</span> : <button type="button" aria-label={`Remove attendee ${index + 1}`} onClick={() => setAttendees((current) => current.filter((item) => item.id !== person.id))} className="checkout-remove"><DiscoverIcon name="x" /></button>}</div>
            <div className="checkout-attendee-fields">
              <label>First Name<input required autoComplete={index === 0 ? "given-name" : "off"} value={person.firstName} onFocus={revealField} onChange={(e) => updateAttendee(person.id, "firstName", e.target.value)} /></label>
              <label>Last Name<input required autoComplete={index === 0 ? "family-name" : "off"} value={person.lastName} onFocus={revealField} onChange={(e) => updateAttendee(person.id, "lastName", e.target.value)} /></label>
              <label className="checkout-email">Email{index > 0 ? " (optional)" : ""}<input type="email" required={index === 0} autoComplete={index === 0 ? "email" : "off"} value={person.email} onFocus={revealField} onChange={(e) => updateAttendee(person.id, "email", e.target.value)} /></label>
            </div>
            {index > 0 && following.length > 0 && <div className="checkout-following-picker"><span>Add someone you follow</span><div>{following.map((followed) => <button type="button" key={followed.id} aria-pressed={person.userId === followed.id} onClick={() => selectFollowing(person.id, followed)}><i style={followed.avatarUrl ? { backgroundImage: `url(${followed.avatarUrl})` } : undefined}>{!followed.avatarUrl ? followed.name.slice(0, 1).toUpperCase() : ""}</i><strong>{followed.name}</strong>{followed.username && <small>@{followed.username}</small>}</button>)}</div></div>}
            {index === 0 && <p className="checkout-email-hint">Your tickets will be sent to this email and available in the app.</p>}
          </div>)}
        </div>

        <button type="button" className="checkout-add-attendee" onClick={addAttendee}><span aria-hidden="true">＋</span><span><strong>Add Another Attendee</strong><small>Send tickets to friends or add them later.</small></span></button>

        <h2 className="checkout-extras-title">Extras</h2>
        <div className="checkout-extra"><span className="checkout-extra-icon" aria-hidden="true"><DiscoverIcon name="send" /></span><div className="checkout-extra-copy"><strong>Stay Updated</strong><small>Get event updates, schedule changes and important info.</small></div><button type="button" role="switch" aria-checked={updates} aria-label="Stay Updated" onClick={() => setUpdates(!updates)} className="checkout-switch"><span /></button></div>
      </section></div>
      <div className="checkout-fixed-action">
        <button type="submit" className="checkout-continue">Continue to Payment <DiscoverIcon name="arrow" /></button>
        {notice && <p className="checkout-notice" role="status">{notice}</p>}
      </div>
    </form>
    <span className="sr-only">Selected: {quantity} {tier.name} tickets</span>
  </div>;
}
