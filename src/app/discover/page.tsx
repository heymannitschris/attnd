import { DiscoverExperience } from "@/components/events/DiscoverExperience";
import { getPublishedEventBundles } from "@/lib/events-data";

export const revalidate = 30;

export default async function DiscoverPage() {
  return <DiscoverExperience initialBundles={await getPublishedEventBundles()} />;
}
