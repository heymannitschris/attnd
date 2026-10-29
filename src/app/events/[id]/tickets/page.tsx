import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TicketSelectionScreen } from "@/components/events/TicketSelectionScreen";
import { getEventBundle } from "@/lib/events-data";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const bundle = await getEventBundle(id);
  return { title: bundle ? `Select Tickets · ${bundle.event.title} | Attnd` : "Event not found" };
}

export default async function TicketPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { from } = await searchParams;
  const bundle = await getEventBundle(id);
  if (!bundle || bundle.details.admission !== "tickets") notFound();
  return <TicketSelectionScreen event={bundle.event} tiers={bundle.tiers} showGoing={from === "swipe"} databaseEventId={bundle.databaseId} />;
}
