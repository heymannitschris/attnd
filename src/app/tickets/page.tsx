import type { Metadata } from "next";
import { MyTicketsScreen } from "@/components/tickets/MyTicketsScreen";

export const metadata: Metadata = { title: "Tickets | Attnd" };

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function TicketsPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const initialTab = tab === "To Review" || tab === "Reviewed" || tab === "Cancelled" || tab === "Guestlist" ? tab : "Upcoming";
  return <MyTicketsScreen initialTab={initialTab} />;
}
