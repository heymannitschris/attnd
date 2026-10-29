export type EarningsSummary = {
  source: "host" | "cohost" | "team";
  balances: Array<{ currency: string; totalMinor: number; availableMinor: number; pendingMinor: number; transferredMinor: number }>;
  byEvent: Array<{ id: string; slug: string; title: string; coverUrl: string | null; startsAt: string | null; currencies: Array<{ currency: string; amountMinor: number; sales: number }> }>;
  payouts: Array<{ id: string; amount_minor: number; fee_minor: number; currency: string; status: string; created_at: string; paid_at: string | null }>;
  activity: Array<{ eventId: string; amountMinor: number; currency: string; createdAt: string }>;
};
