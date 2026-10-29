import type { Metadata } from "next";
import { TransferTicketScreen } from "@/components/tickets/TransferTicketScreen";

export const metadata: Metadata = { title: "Transfer Ticket | Attnd" };

export default async function TransferTicketPage({ searchParams }: { searchParams: Promise<{ ticket?: string }> }) {
  const { ticket } = await searchParams;
  return <TransferTicketScreen ticketId={ticket} />;
}
