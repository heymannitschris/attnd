import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetailsScreen } from "@/components/events/EventDetailsScreen";
import { getEventBundle } from "@/lib/events-data";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_URL } from "@/lib/seo/site";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const bundle = await getEventBundle(id);
  if (!bundle) return { title: "Event not found" };
  const { event, details } = bundle;
  const title = event.title;
  const description = details.description?.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1").trim() || `${event.date} at ${event.time} · ${event.location} · ${event.price}`;
  const image = event.image.startsWith("http") ? event.image : new URL(event.image, "https://www.attnd.space").toString();
  const canonical = `/events/${event.id}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: "attnd",
      locale: "en_US",
      url: canonical,
      title: event.title,
      description,
      images: [{ url: image, alt: event.imageAlt || event.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: [image],
    },
  };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const bundle = await getEventBundle(id);
  if (!bundle) notFound();
  const { event, details, tiers } = bundle;
  const url = `${SITE_URL}/events/${event.id}`;
  const image = event.image.startsWith("http") ? event.image : new URL(event.image, SITE_URL).toString();
  const currency = event.price.match(/[A-Z]{3}/)?.[0] || "THB";
  const online = event.location === "Online";
  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: details.description?.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1").trim() || undefined,
    url,
    image: [image],
    ...(event.startsAt ? { startDate: event.startsAt } : {}),
    ...(event.endsAt ? { endDate: event.endsAt } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: online ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
    location: online
      ? { "@type": "VirtualLocation", url }
      : { "@type": "Place", name: event.location, address: event.distance || event.location },
    organizer: { "@type": "Person", name: details.host.name, url: `${SITE_URL}/people/${details.host.id}` },
    ...(tiers.length ? {
      offers: tiers.map((tier) => ({
        "@type": "Offer",
        name: tier.name,
        price: tier.price,
        priceCurrency: tier.currency || currency,
        availability: tier.availability === "sold-out" ? "https://schema.org/SoldOut" : tier.availability === "limited" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock",
        url,
      })),
    } : {}),
  };
  return <><JsonLd data={eventJsonLd} /><EventDetailsScreen key={id} event={bundle.event} details={bundle.details} databaseEventId={bundle.databaseId} /></>;
}
