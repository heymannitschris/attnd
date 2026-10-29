import type { Metadata } from "next";
import { LocalMembershipScreen } from "@/components/profile/LocalMembershipScreen";

export const metadata: Metadata = { title: "Local Membership | Attnd" };

export default function LocalMembershipPage() {
  return <LocalMembershipScreen />;
}
