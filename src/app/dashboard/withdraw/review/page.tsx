import { HostWithdrawReviewScreen } from "@/components/affiliate/AffiliateDashboardScreens";

export default async function HostWithdrawReviewPage({ searchParams }: { searchParams: Promise<{ amount?: string; currency?: string; source?: string }> }) {
  const query = await searchParams;
  return <HostWithdrawReviewScreen amountValue={query.amount} currency={query.currency || "thb"} source={query.source === "cohost" || query.source === "team" ? query.source : "host"} />;
}
