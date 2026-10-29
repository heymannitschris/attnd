import type { Metadata } from "next";
import { HostProfileScreen } from "@/components/profile/HostProfileScreen";
import { lukasProfile } from "@/lib/mock-host-profile";

export const metadata: Metadata = {
  title: "Lukas Weber | Attnd",
  description: "Host profile and events by Lukas Weber.",
};

export default function LukasWeberPage() {
  return <HostProfileScreen profile={lukasProfile} profileId="lukas-weber" />;
}
