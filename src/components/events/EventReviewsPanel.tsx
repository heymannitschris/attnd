"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { DiscoverIcon } from "./DiscoverIcon";

type Review = {
  id: string;
  user_id: string;
  rating: number;
  body: string;
  created_at: string;
  updated_at: string;
  profiles: { first_name: string | null; username: string | null; avatar_url: string | null } | null;
};
type OwnReview = { id: string; rating: number; body: string; status: string } | null;
type ReviewResponse = { reviews: Review[]; summary: { count: number; average: number }; canReview: boolean; ownReview: OwnReview; authenticated: boolean; error?: string };

function Stars({ value, interactive = false, onChange }: { value: number; interactive?: boolean; onChange?: (rating: number) => void }) {
  return <span className={`event-review-stars${interactive ? " is-interactive" : ""}`} aria-label={`${value} out of 5 stars`}>{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" disabled={!interactive} aria-label={`${rating} stars`} aria-pressed={interactive ? rating === value : undefined} onClick={() => onChange?.(rating)}>★</button>)}</span>;
}

export function EventReviewsPanel({ eventId }: { eventId: string }) {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/reviews`, { cache: "no-store" });
    const result = await response.json() as ReviewResponse;
    if (!response.ok) { setNotice(result.error || "Reviews could not be loaded"); return; }
    setData(result);
    if (result.ownReview) { setRating(result.ownReview.rating); setBody(result.ownReview.body); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    setBusy(true); setNotice("");
    const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/reviews`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rating, body }) });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) { setNotice(result.error || "Review could not be saved"); return; }
    setEditing(false); setNotice("Review published"); await load();
  }
  async function remove() {
    setBusy(true);
    const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/reviews`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) { const result = await response.json() as { error?: string }; setNotice(result.error || "Review could not be deleted"); return; }
    setBody(""); setRating(5); setEditing(false); setNotice("Review deleted"); await load();
  }
  async function report(reviewId: string) {
    const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/reviews`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "report", reviewId, reason: "Inappropriate or misleading review" }) });
    const result = await response.json() as { error?: string };
    setNotice(response.ok ? "Review reported for moderation" : result.error || "Report could not be sent");
  }

  if (!data) return <section className="event-reviews-loading"><span /><p>{notice || "Loading verified reviews…"}</p></section>;
  const showForm = data.canReview && (!data.ownReview || editing);
  return <section className="event-reviews-panel">
    <div className="event-reviews-summary"><div><strong>{data.summary.count ? data.summary.average.toFixed(1) : "—"}</strong><Stars value={Math.round(data.summary.average)} /><span>{data.summary.count} verified {data.summary.count === 1 ? "review" : "reviews"}</span></div><p><DiscoverIcon name="check" /><span><strong>Verified attendees only</strong><small>Reviews can be written after the event has ended.</small></span></p></div>
    {data.ownReview && !editing && <article className="event-review-own"><header><div><small>YOUR REVIEW</small><Stars value={data.ownReview.rating} /></div><span>{data.ownReview.status === "hidden" ? "Under moderation" : "Published"}</span></header><p>{data.ownReview.body}</p><footer><button type="button" onClick={() => setEditing(true)}>Edit review</button><button type="button" disabled={busy} onClick={() => void remove()}>Delete</button></footer></article>}
    {showForm && <section className="event-review-form"><h3>{data.ownReview ? "Edit your review" : "How was the event?"}</h3><p>Your review will be marked as verified.</p><Stars value={rating} interactive onChange={setRating} /><textarea value={body} maxLength={1500} onChange={(event) => setBody(event.target.value)} placeholder="Share what the experience was really like…" /><div><small>{body.length}/1500</small><button type="button" onClick={() => { setEditing(false); if (data.ownReview) { setRating(data.ownReview.rating); setBody(data.ownReview.body); } }}>{data.ownReview ? "Cancel" : "Clear"}</button><button type="button" disabled={busy || body.trim().length < 5} onClick={() => void save()}>{busy ? "Saving…" : "Publish review"}</button></div></section>}
    {!data.canReview && !data.ownReview && <div className="event-review-eligibility"><DiscoverIcon name="ticket" /><p><strong>Attend first, review after</strong><span>{data.authenticated ? "Your ticket becomes eligible for review when the event ends." : "Sign in with the account that holds your ticket to leave a verified review."}</span></p>{!data.authenticated && <Link href={`/onboarding?next=${encodeURIComponent(`/events/${eventId}`)}`}>Sign in</Link>}</div>}
    <div className="event-reviews-list">{data.reviews.map((review, index) => { const profile = review.profiles; const name = profile?.first_name || profile?.username || "Attnd guest"; return <article key={review.id}><header><Avatar name={name} portrait={index % 4} avatarUrl={profile?.avatar_url || undefined} size={42} /><p><strong>{name}</strong><span><DiscoverIcon name="check" />Verified attendee</span></p><time>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(review.created_at))}</time></header><Stars value={review.rating} /><p>{review.body}</p>{review.id !== data.ownReview?.id && <button type="button" onClick={() => void report(review.id)}>Report review</button>}</article>; })}{!data.reviews.length && <div className="event-reviews-empty"><span>★</span><h3>No verified reviews yet</h3><p>Checked-in guests can be the first to share their experience.</p></div>}</div>
    {notice && <p className="event-review-notice" role="status">{notice}</p>}
  </section>;
}
