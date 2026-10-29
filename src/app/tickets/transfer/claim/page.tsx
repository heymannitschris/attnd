import type { Metadata } from "next";
import { TransferClaimScreen } from "@/components/tickets/TransferClaimScreen";

export const metadata: Metadata = { title: "Accept Ticket | Attnd" };

export default async function TransferClaimPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <TransferClaimScreen token={token || ""} />;
}
