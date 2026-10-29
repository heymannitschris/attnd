import { HostWithdrawScreen } from "@/components/affiliate/AffiliateDashboardScreens";

export default async function HostWithdrawPage({ searchParams }: { searchParams: Promise<{ source?: string; currency?: string }> }) {
  const query = await searchParams;
  return <HostWithdrawScreen source={query.source === "cohost" || query.source === "team" ? query.source : "host"} initialCurrency={query.currency || "thb"} />;
}
