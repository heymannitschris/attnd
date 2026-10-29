"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";

type LeaderboardEntry = { rank: number; userId: string; name: string; username: string; avatarUrl: string; city: string; points: number; lifetimePoints: number; level: number };

export function LeaderboardScreen() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/leaderboard", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { entries?: LeaderboardEntry[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Leaderboard could not be loaded");
      if (active) setEntries(result.entries || []);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Leaderboard could not be loaded"); });
    return () => { active = false; };
  }, []);

  return <div className="leaderboard-screen">
    <header className="leaderboard-header"><Link href="/profile" aria-label="Back to profile"><DiscoverIcon name="arrow" /></Link><h1>Leaderboard</h1><span /></header>
    <div className="leaderboard-table" role="table" aria-label="Attnd leaderboard">
      <div className="leaderboard-table-head" role="row"><span>Rank</span><span>Member</span><span>Level</span><span>Points</span></div>
      {entries === null && !error ? <p className="leaderboard-state">Loading leaderboard…</p> : error ? <p className="leaderboard-state">{error}</p> : entries?.map((entry) => <Link href={`/people/${entry.userId}`} key={entry.userId} className="leaderboard-row" role="row">
        <strong className="leaderboard-rank">{entry.rank <= 3 ? ["🥇","🥈","🥉"][entry.rank - 1] : entry.rank}</strong>
        <span className="leaderboard-person">{entry.avatarUrl ? <Image src={entry.avatarUrl} alt="" width={42} height={42} unoptimized={entry.avatarUrl.startsWith("http")} /> : <i>{entry.name.slice(0,1).toUpperCase()}</i>}<span><b>{entry.name}</b><small>{entry.username ? `@${entry.username}` : entry.city || "Attnd member"}</small></span></span>
        <b className="leaderboard-level">L{entry.level}</b>
        <span className="leaderboard-points"><b>{entry.lifetimePoints.toLocaleString()}</b><small>{entry.points.toLocaleString()} available</small></span>
      </Link>)}
      {entries?.length === 0 && <p className="leaderboard-state">The leaderboard is ready for its first member.</p>}
    </div>
  </div>;
}
