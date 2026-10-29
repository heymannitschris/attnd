import type { Metadata } from "next";
import { OwnProfileScreen } from "@/components/profile/OwnProfileScreen";

export const metadata: Metadata = {
  title: "My Profile | Attnd",
  description: "Your events, interests and profile activity.",
};

export default function ProfilePage() {
  return <OwnProfileScreen />;
}
