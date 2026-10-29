import type { Metadata } from "next";
import { SocialConnectionsScreen } from "@/components/profile/SocialConnectionsScreen";

export const metadata: Metadata = { title: "Followers · Lukas Weber | Attnd" };

export default function FollowersPage() { return <SocialConnectionsScreen kind="followers" />; }
