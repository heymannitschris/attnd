import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FreeRsvpScreen } from "@/components/events/FreeRsvpScreen";
import { getEventBundle } from "@/lib/events-data";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Reserve Free Spot | Attnd" };

export default async function RsvpPage({ params }: Props) {
  const { id } = await params;
  const bundle = await getEventBundle(id);
  const freeTier = bundle?.tiers.find((tier) => tier.price === 0 && tier.availability !== "sold-out");
  if (!bundle || bundle.details.admission !== "rsvp" || !freeTier) notFound();
  return <FreeRsvpScreen event={bundle.event} databaseEventId={bundle.databaseId} ticketTypeId={freeTier.id} />;
}
