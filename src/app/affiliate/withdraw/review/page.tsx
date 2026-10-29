import { AffiliateReviewScreen } from "@/components/affiliate/AffiliateDashboardScreens";
export default async function AffiliateReviewPage({ searchParams }: { searchParams: Promise<{ amount?: string; currency?: string; method?: string }> }) {
  const query = await searchParams;
  return <AffiliateReviewScreen amountValue={query.amount} currencyValue={query.currency} methodValue={query.method} />;
}
