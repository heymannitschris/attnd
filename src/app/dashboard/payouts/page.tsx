import { HostPayoutHistoryScreen } from "@/components/affiliate/AffiliateDashboardScreens";

export default async function HostPayoutsPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const query = await searchParams;
  return <HostPayoutHistoryScreen source={query.source === "cohost" || query.source === "team" ? query.source : "host"} />;
}
