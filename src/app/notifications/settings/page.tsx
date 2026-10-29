import type { Metadata } from "next";
import { NotificationSettingsScreen } from "@/components/notifications/NotificationSettingsScreen";

export const metadata: Metadata = { title: "Notification Settings | Attnd" };

export default function NotificationSettingsPage() { return <NotificationSettingsScreen />; }
