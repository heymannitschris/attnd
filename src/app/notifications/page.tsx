import type { Metadata } from "next";
import { NotificationsScreen } from "@/components/notifications/NotificationsScreen";

export const metadata: Metadata = { title: "Notifications | Attnd" };

export default function NotificationsPage() { return <NotificationsScreen />; }
