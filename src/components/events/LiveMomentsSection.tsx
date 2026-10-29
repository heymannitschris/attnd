"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { buildAffiliateEventUrl } from "@/lib/affiliate-links";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { DiscoverIcon } from "./DiscoverIcon";

type Moment = {
  id: string;
  user_id: string;
  public_url: string;
  kind: "photo" | "video";
  caption: string;
  created_at: string;
  profiles?: { first_name?: string | null; username?: string | null; avatar_url?: string | null } | null;
};

export function LiveMomentsSection({ eventId, eventSlug, eventTitle, startsAt, endsAt, enabled }: { eventId: string; eventSlug: string; eventTitle: string; startsAt?: string; endsAt?: string; enabled?: boolean }) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [canUpload, setCanUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const now = Date.now();
  const isLive = Boolean(enabled && startsAt && endsAt && new Date(startsAt).getTime() <= now && new Date(endsAt).getTime() >= now);
  const isPast = Boolean(endsAt && new Date(endsAt).getTime() < now);

  useEffect(() => {
    if (!hasSupabaseConfig || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(eventId)) return;
    let active = true;
    void fetch(`/api/events/${eventId}/live-moments`).then(async (response) => {
      const result = await response.json() as { moments?: Moment[]; canUpload?: boolean };
      if (active && response.ok) { setMoments(result.moments || []); setCanUpload(Boolean(result.canUpload)); }
    });
    return () => { active = false; };
  }, [eventId]);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    void createClient().auth.getUser().then(({ data }) => {
      if (data.user) window.localStorage.setItem("attnd:user-id", data.user.id);
    });
  }, []);

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true); setNotice("");
    const form = new FormData(); form.set("file", file);
    const response = await fetch(`/api/events/${eventId}/live-moments`, { method: "POST", body: form });
    const result = await response.json() as { moment?: Moment; error?: string };
    if (response.ok && result.moment) { setMoments((current) => [result.moment!, ...current]); setNotice("Your moment is live"); }
    else setNotice(result.error || "Upload failed");
    setUploading(false); if (inputRef.current) inputRef.current.value = "";
  }

  async function share(moment?: Moment) {
    const url = new URL(buildAffiliateEventUrl(window.location.origin, eventSlug));
    if (moment) url.searchParams.set("moment", moment.id);
    const text = moment ? `See what’s happening at ${eventTitle} right now` : `Join me at ${eventTitle}`;
    if (moment) void fetch(`/api/events/${eventId}/live-moments/${moment.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "share" }) });
    if (navigator.share) {
      try {
        if (moment && "canShare" in navigator) {
          const response = await fetch(moment.public_url);
          const blob = await response.blob();
          const extension = moment.kind === "video" ? "mp4" : "jpg";
          const file = new File([blob], `attnd-${moment.id}.${extension}`, { type: blob.type || (moment.kind === "video" ? "video/mp4" : "image/jpeg") });
          const payload = { title: eventTitle, text: `${text}\n${url.toString()}`, files: [file] };
          if (navigator.canShare(payload)) { await navigator.share(payload); return; }
        }
        await navigator.share({ title: eventTitle, text, url: url.toString() }); return;
      }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
    }
    await navigator.clipboard.writeText(url.toString()); setNotice("Affiliate link copied");
  }

  async function report(moment: Moment) {
    const response = await fetch(`/api/events/${eventId}/live-moments/${moment.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "report", reason: "Inappropriate or misleading event content" }) });
    const result = await response.json() as { error?: string };
    setNotice(response.ok ? "Thanks. The host will review this moment." : result.error || "Could not send report");
  }

  if (!enabled && !moments.length) return null;
  return <section className="live-moments" aria-labelledby="live-moments-title">
    <header><div><span className={isLive ? "is-live" : ""}>{isLive ? "LIVE NOW" : isPast ? "EVENT MEMORIES" : "LIVE MOMENTS"}</span><h2 id="live-moments-title">{isLive ? "What’s happening now" : "Moments from the event"}</h2><p>{isLive ? "Real photos and videos shared by checked-in guests." : "See the event through the community’s eyes."}</p></div><button type="button" onClick={() => void share()}><DiscoverIcon name="share" /> Share &amp; Earn</button></header>
    {moments.length ? <div className="live-moments-rail">{moments.map((moment) => <article key={moment.id}>{moment.kind === "video" ? <video src={moment.public_url} controls playsInline preload="metadata" /> : <Image src={moment.public_url} alt={moment.caption || `${eventTitle} live moment`} fill sizes="220px" />}<span className="live-moment-shade" /><div><strong>{moment.profiles?.first_name || moment.profiles?.username || "Attnd guest"}</strong><small>{moment.caption || "Live from the event"}</small></div><button type="button" className="live-moment-report" onClick={() => void report(moment)} aria-label="Report this moment">!</button><button type="button" onClick={() => void share(moment)} aria-label="Share this moment with your affiliate link"><DiscoverIcon name="share" /></button></article>)}</div> : <div className="live-moments-empty"><DiscoverIcon name="camera" /><p><strong>Be the first to share the atmosphere</strong><span>Checked-in guests can add a photo or short video.</span></p></div>}
    {isLive && <div className="live-moments-upload"><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime" onChange={(event) => void upload(event.target.files?.[0])} /><button type="button" disabled={uploading} onClick={() => canUpload ? inputRef.current?.click() : setNotice("Check in at the event before uploading")}>{uploading ? "Uploading…" : <><DiscoverIcon name="camera" /> Add a Live Moment</>}</button><small>{canUpload ? "Your moment appears here immediately." : "Available after your ticket is checked in."}</small></div>}
    {notice && <p role="status" className="live-moments-notice">{notice}</p>}
  </section>;
}
