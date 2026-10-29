import type { Metadata } from "next";
import { LeaderboardScreen } from "@/components/profile/LeaderboardScreen";

export const metadata: Metadata = { title: "Leaderboard | Attnd", description: "Attnd member points and levels." };

export default function LeaderboardPage() {
  return <LeaderboardScreen />;
}
