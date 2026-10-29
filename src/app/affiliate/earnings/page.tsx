import type { Metadata } from "next";
import { AffiliateEarningsScreen } from "@/components/affiliate/AffiliateDashboardScreens";

export const metadata: Metadata = { title: "All Affiliate Earnings | Attnd" };

export default function AffiliateEarningsPage() {
  return <AffiliateEarningsScreen />;
}
