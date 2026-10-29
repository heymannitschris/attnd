import type { Metadata } from "next";
import { ProfileSettingsScreen } from "@/components/profile/ProfileSettingsScreen";

export const metadata: Metadata = { title: "Profile Settings | Attnd" };

export default function ProfileSettingsPage() {
  return <ProfileSettingsScreen />;
}

