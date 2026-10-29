import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutPaymentScreen } from "@/components/events/CheckoutPaymentScreen";
import { getEventBundle } from "@/lib/events-data";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tier?: string; quantity?: string; checkout?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const bundle = await getEventBundle(id);
  return { title: bundle ? `Payment · ${bundle.event.title} | Attnd` : "Event not found" };
}

export default async function CheckoutPaymentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const bundle = await getEventBundle(id);
  if (!bundle || bundle.details.admission !== "tickets") notFound();
  const tier = bundle.tiers.find((item) => item.id === query.tier) ?? bundle.tiers[0];
  if (!tier) notFound();
  const parsedQuantity = Number(query.quantity);
  const quantity = Number.isInteger(parsedQuantity) ? Math.min(10, Math.max(1, parsedQuantity)) : 2;
  return <CheckoutPaymentScreen event={bundle.event} databaseEventId={bundle.databaseId} tier={tier} quantity={quantity} cancelled={query.checkout === "cancelled"} />;
}
