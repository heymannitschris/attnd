import type { Metadata } from "next";
import { ExploreExperience } from "@/components/events/ExploreExperience";
import { getPublishedEventBundles, getPublishedExploreEvents } from "@/lib/events-data";

export const metadata: Metadata = { title: "Explore | Attnd" };
export const revalidate = 30;

export default async function ExplorePage() {
  const [events, bundles] = await Promise.all([getPublishedExploreEvents(), getPublishedEventBundles()]);
  return <ExploreExperience initialEvents={events} initialBundles={bundles.map(({ event, details, databaseId }) => ({ event, details, databaseId }))} />;
}
