import { absoluteUrl, formatEventWhen, mapsUrl, renderEmail, SITE_URL, type EmailDetail } from "@/lib/emails/layout";

export type EmailEvent = {
  title: string;
  slug?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  timezone?: string | null;
  venue_name?: string | null;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  cover_url?: string | null;
};

const eventUrl = (event: EmailEvent) => (event.slug ? `${SITE_URL}/events/${event.slug}` : SITE_URL);

function eventDetails(event: EmailEvent, extra: EmailDetail[] = []): EmailDetail[] {
  const rows: EmailDetail[] = [];
  if (event.starts_at) {
    const when = formatEventWhen(event.starts_at, event.ends_at, event.timezone);
    rows.push({ label: "Date", value: when.date }, { label: "Time", value: when.time });
  }
  const place = [event.venue_name, event.address, event.city].filter(Boolean).join(", ");
  if (place) rows.push({ label: "Location", value: place, href: mapsUrl(event) });
  return [...rows, ...extra];
}

const cover = (event: EmailEvent) => ({ coverUrl: absoluteUrl(event.cover_url), coverAlt: event.title });

export function eventReminderEmail(event: EmailEvent, kind: "24h" | "3h") {
  const when = kind === "3h" ? "in about 3 hours" : "tomorrow";
  return renderEmail(`${event.title} starts ${when}`, {
    preheader: `Your saved event starts ${when}. Here are the details.`,
    eyebrow: kind === "3h" ? "Starting soon" : "Tomorrow",
    heading: `${event.title} starts ${when}`,
    paragraphs: ["You saved this event on attnd. Here’s everything you need to be there."],
    ...cover(event),
    details: eventDetails(event),
    cta: { label: "View event", href: eventUrl(event) },
    secondaryLink: { label: "Open in Maps", href: mapsUrl(event) || eventUrl(event) },
    footnote: "You get this reminder because you saved this event.",
  });
}

export function ticketConfirmationEmail(input: { event: EmailEvent; buyerName?: string | null; tickets: Array<{ typeName: string; qrSrc?: string }>; totalLabel?: string; orderRef: string }) {
  const { event } = input;
  const count = input.tickets.length;
  const types = [...new Set(input.tickets.map((ticket) => ticket.typeName))].join(", ");
  return renderEmail(`Your ticket${count === 1 ? "" : "s"} for ${event.title}`, {
    preheader: `You’re going to ${event.title}. Your QR code is inside.`,
    eyebrow: "Order confirmed",
    heading: "You’re going!",
    paragraphs: [`${input.buyerName ? `${input.buyerName}, your` : "Your"} ${count === 1 ? "ticket" : `${count} tickets`} for ${event.title} ${count === 1 ? "is" : "are"} confirmed. Show the QR code at the door, or open it in the attnd app.`],
    ...cover(event),
    details: eventDetails(event, [
      { label: "Tickets", value: `${count} × ${types}` },
      ...(input.totalLabel ? [{ label: "Total paid", value: input.totalLabel }] : []),
      { label: "Order", value: input.orderRef },
    ]),
    qr: input.tickets[0]?.qrSrc ? { src: input.tickets[0].qrSrc, caption: count > 1 ? "First ticket shown. All tickets are in the app." : "Scan at entry · keep this private" } : undefined,
    cta: { label: count === 1 ? "View ticket" : "View tickets", href: `${SITE_URL}/tickets` },
    secondaryLink: { label: "Event details", href: eventUrl(event) },
    footnote: "Refunds and transfers are handled in the app under Tickets.",
    showPreferences: false,
  });
}

export function guestlistEmail(input: { event: EmailEvent; name: string; plusOnes: number }) {
  const plus = input.plusOnes > 0 ? ` with ${input.plusOnes} plus-one${input.plusOnes === 1 ? "" : "s"}` : "";
  return renderEmail(`You’re on the guestlist for ${input.event.title}`, {
    preheader: "Your Guestlist Pass and QR code are ready in attnd.",
    eyebrow: "Guestlist",
    heading: "You’re on the list",
    paragraphs: [`${input.name}, the host added you to ${input.event.title}${plus}.`, "Your Guestlist Pass and QR code are waiting in attnd."],
    ...cover(input.event),
    details: eventDetails(input.event),
    cta: { label: "Open Guestlist Pass", href: `${SITE_URL}/tickets?tab=Guestlist` },
    secondaryLink: { label: "Event details", href: eventUrl(input.event) },
    showPreferences: false,
  });
}

export function inviteEmail(input: { event: EmailEvent; message?: string | null; inviteUrl: string; inviterName?: string | null }) {
  return renderEmail(`You’re invited to ${input.event.title}`, {
    preheader: `${input.inviterName || "Someone"} invited you to ${input.event.title} on attnd.`,
    eyebrow: "Invitation",
    heading: `You’re invited to ${input.event.title}`,
    paragraphs: [input.message || "You have been invited to an event on attnd."],
    ...cover(input.event),
    details: eventDetails(input.event),
    cta: { label: "View invitation", href: input.inviteUrl },
    footnote: "You got this email because someone entered your address on attnd.",
    showPreferences: false,
  });
}

export function ticketTransferEmail(input: { eventTitle: string; message?: string | null; claimUrl: string; event?: EmailEvent }) {
  const event = input.event || { title: input.eventTitle };
  return renderEmail(`A ticket for ${input.eventTitle} was sent to you`, {
    preheader: "Accept it to add it to your attnd tickets.",
    eyebrow: "Ticket transfer",
    heading: "Your ticket is waiting",
    paragraphs: [input.message || "A friend sent you a ticket.", "Accept it to add it to your tickets and get your QR code."],
    ...cover(event),
    details: eventDetails(event),
    cta: { label: "Accept ticket", href: input.claimUrl },
    showPreferences: false,
  });
}

export function waitlistOfferEmail(input: { event: EmailEvent; tierName?: string | null; href: string }) {
  return renderEmail(`Your ticket for ${input.event.title} is available`, {
    preheader: "We reserved a ticket for you for 30 minutes.",
    eyebrow: "Waitlist",
    heading: "A ticket is yours — for 30 minutes",
    paragraphs: [`We reserved ${input.tierName || "a ticket"} for ${input.event.title}. Complete your purchase within 30 minutes or it goes to the next person.`],
    ...cover(input.event),
    details: eventDetails(input.event),
    cta: { label: "Buy your ticket", href: input.href },
  });
}

/** Generic in-app notification mirrored to email (followers, refunds, sales, …). */
export function notificationEmail(input: { title: string; body: string; href: string; event?: EmailEvent | null }) {
  return renderEmail(input.title, {
    preheader: input.body,
    heading: input.title,
    paragraphs: [input.body],
    ...(input.event ? cover(input.event) : {}),
    cta: { label: "Open attnd", href: input.href },
  });
}

export function moderationReportEmail(input: { targetType: string; reason: string; targetId: string; reporterId: string; link: string; adminUrl: string }) {
  return renderEmail(`[attnd report] ${input.targetType}: ${input.reason}`.slice(0, 140), {
    preheader: `New ${input.targetType} report — review within 24 hours.`,
    eyebrow: "Safety · review within 24h",
    heading: `New ${input.targetType} report`,
    paragraphs: ["A user reported content on attnd. Apple requires action on objectionable content within 24 hours."],
    details: [
      { label: "Type", value: input.targetType },
      { label: "Reason", value: input.reason },
      { label: "Reported item", value: input.link, href: input.link },
      { label: "Target id", value: input.targetId },
      { label: "Reporter id", value: input.reporterId },
    ],
    cta: { label: "Open admin", href: input.adminUrl },
    showPreferences: false,
  });
}

export function accountDeletedEmail(input: { name?: string | null }) {
  return renderEmail("Your attnd account has been deleted", {
    preheader: "Your account and personal data were removed.",
    eyebrow: "Account",
    heading: "Your account has been deleted",
    paragraphs: [`${input.name ? `${input.name}, we` : "We"} deleted your attnd account and the personal data linked to it. Records we must keep by law (for example paid orders) are retained in anonymised form.`, "If you didn’t request this, contact us right away."],
    cta: { label: "Contact support", href: "mailto:info@ninjaworld.games" },
    showPreferences: false,
  });
}
