import type { Metadata } from "next";
import { TicketInvitationScreen } from "@/components/tickets/TicketInvitationScreen";

export const metadata: Metadata = { title: "Ticket Invitation | Attnd" };

export default function TicketInvitationPage() { return <TicketInvitationScreen />; }
