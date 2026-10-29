import type { Metadata } from "next";
import { AffiliateEventEarningsScreen } from "@/components/affiliate/AffiliateDashboardScreens";

export const metadata: Metadata = { title: "Earnings by Event | Attnd" };

export default function AffiliateEventEarningsPage() {
  return <AffiliateEventEarningsScreen />;
}
