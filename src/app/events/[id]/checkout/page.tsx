import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutDetailsScreen } from "@/components/events/CheckoutDetailsScreen";
import { getEventBundle } from "@/lib/events-data";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tier?: string; quantity?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const bundle = await getEventBundle(id);
  return { title: bundle ? `Checkout · ${bundle.event.title} | Attnd` : "Event not found" };
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tier: tierId, quantity: count } = await searchParams;
  const bundle = await getEventBundle(id);
  if (!bundle || bundle.details.admission !== "tickets") notFound();
  const tier = bundle.tiers.find((item) => item.id === tierId && item.availability !== "sold-out") ?? bundle.tiers.find((item) => item.availability !== "sold-out");
  if (!tier) notFound();
  const parsedQuantity = Number(count);
  const quantity = Number.isInteger(parsedQuantity) ? Math.min(10, Math.max(1, parsedQuantity)) : 2;
  return <CheckoutDetailsScreen event={bundle.event} tier={tier} quantity={quantity} />;
}
