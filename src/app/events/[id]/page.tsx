import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetailsScreen } from "@/components/events/EventDetailsScreen";
import { getEventBundle } from "@/lib/events-data";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const bundle = await getEventBundle(id);
  if (!bundle) return { title: "Event not found" };
  const { event, details } = bundle;
  const title = `${event.title} · Attnd`;
  const description = details.description?.trim() || `${event.date} at ${event.time} · ${event.location} · ${event.price}`;
  const image = event.image.startsWith("http") ? event.image : new URL(event.image, "https://www.attnd.space").toString();
  const canonical = `/events/${event.id}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: "Attnd",
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
  return <EventDetailsScreen key={id} event={bundle.event} details={bundle.details} databaseEventId={bundle.databaseId} />;
}
