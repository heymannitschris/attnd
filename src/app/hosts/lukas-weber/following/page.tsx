import type { Metadata } from "next";
import { SocialConnectionsScreen } from "@/components/profile/SocialConnectionsScreen";

export const metadata: Metadata = { title: "Following · Lukas Weber | Attnd" };

export default function FollowingPage() { return <SocialConnectionsScreen kind="following" />; }
