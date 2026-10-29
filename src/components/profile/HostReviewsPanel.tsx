"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";

type HostReview = { id: string; rating: number; body: string; created_at: string; profiles: { first_name: string | null; username: string | null; avatar_url: string | null } | null; events: { title: string; slug: string } | null };
type Result = { reviews?: HostReview[]; summary?: { count: number; average: number }; error?: string };

function ReviewStars({ value }: { value: number }) {
  return <span className="host-review-stars" aria-label={`${value} out of 5 stars`}>{[1,2,3,4,5].map((star) => <i key={star} data-filled={star <= Math.round(value)}>★</i>)}</span>;
}

export function HostReviewsPanel({ hostId }: { hostId?: string }) {
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    if (!hostId) { setResult({ reviews: [], summary: { count: 0, average: 0 } }); return; }
    let active = true;
    void fetch(`/api/hosts/${encodeURIComponent(hostId)}/reviews`, { cache: "no-store" }).then((response) => response.json()).then((data: Result) => { if (active) setResult(data); });
    return () => { active = false; };
  }, [hostId]);
  if (!result) return <div className="host-reviews-empty">Loading host reviews…</div>;
  const reviews = result.reviews || [];
  return <section className="host-reviews-panel">
    <header><strong>{result.summary?.count ? result.summary.average.toFixed(1) : "—"}</strong><div><ReviewStars value={result.summary?.average || 0} /><span>{result.summary?.count || 0} verified host reviews</span></div></header>
    <p className="host-reviews-verified"><DiscoverIcon name="check" />Only guests with a ticket for a completed event can review this host.</p>
    <div>{reviews.map((review, index) => { const name = review.profiles?.first_name || review.profiles?.username || "Attnd guest"; return <article key={review.id}><header><Avatar name={name} portrait={index % 4} avatarUrl={review.profiles?.avatar_url || undefined} size={40} /><p><strong>{name}</strong><small>Verified guest</small></p><ReviewStars value={review.rating} /></header><p>{review.body}</p>{review.events && <Link href={`/events/${review.events.slug}`}>From {review.events.title}</Link>}</article>; })}</div>
    {!reviews.length && <div className="host-reviews-empty"><span>★</span><strong>No host reviews yet</strong><p>Reviews appear here after guests attend an event.</p></div>}
  </section>;
}
