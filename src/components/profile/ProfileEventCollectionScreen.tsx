"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";
import { useSavedEvents } from "@/components/events/SavedEventsProvider";
import { createClient } from "@/lib/supabase/client";
import { eventTimeZone } from "@/lib/event-time";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type SavedEvent = { id: string; databaseId: string; title: string; startsAt: string | null; location: string; image: string; count: number; period: "Upcoming" | "Past"; action: "going" | "rsvp" | "buy" };

export function ProfileEventCollectionScreen() {
  const { savedIds, toggleSaved } = useSavedEvents();
  const [period, setPeriod] = useState("All");
  const [events, setEvents] = useState<SavedEvent[]>([]);
  const [loading, setLoading] = useState(hasSupabaseConfig);

  useEffect(() => {
    if (!hasSupabaseConfig || savedIds.size === 0) { setEvents([]); setLoading(false); return; }
    let active = true;
    setLoading(true);
    const supabase = createClient();
    void Promise.all([
      supabase.from("events").select("id,slug,title,starts_at,venue_name,city,cover_url,event_media(public_url,kind,position),ticket_types(price_minor,sold_count,active)").in("slug", [...savedIds]).eq("status", "published").order("starts_at"),
      supabase.auth.getUser(),
    ]).then(async ([eventResult, authResult]) => {
      if (!active) return;
      const ownedEventIds = new Set<string>();
      if (authResult.data.user) {
        const { data: ownedTickets } = await supabase.from("tickets").select("event_id").eq("owner_id", authResult.data.user.id).in("status", ["valid", "used"]);
        (ownedTickets || []).forEach((ticket) => ownedEventIds.add(ticket.event_id));
      }
      if (!active) return;
      const now = Date.now();
      setEvents((eventResult.data || []).map((row) => {
        const media = (row.event_media as Array<{ public_url: string; kind: string; position: number }> | null)?.filter((item) => item.kind === "photo").sort((a, b) => a.position - b.position);
        const tiers = (row.ticket_types as Array<{ price_minor: number; sold_count: number; active: boolean }> | null)?.filter((tier) => tier.active !== false) || [];
        const count = tiers.reduce((sum, tier) => sum + (tier.sold_count || 0), 0);
        const paid = tiers.some((tier) => tier.price_minor > 0);
        return { id: row.slug, databaseId: row.id, title: row.title, startsAt: row.starts_at, location: [row.venue_name, row.city].filter(Boolean).join(", ") || "Location to be announced", image: row.cover_url || media?.[0]?.public_url || "/placeholders/black.svg", count, period: row.starts_at && new Date(row.starts_at).getTime() < now ? "Past" as const : "Upcoming" as const, action: ownedEventIds.has(row.id) ? "going" as const : paid ? "buy" as const : "rsvp" as const };
      }));
      setLoading(false);
    });
    return () => { active = false; };
  }, [savedIds]);

  const visible = useMemo(() => events.filter((event) => period === "All" || event.period === period), [events, period]);
  const formatDate = (value: string | null) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: eventTimeZone() }) : "Date to be announced";
  return <div className="profile-collection-screen"><header><h1>Saved</h1></header><div role="tablist" className="profile-collection-tabs">{["All", "Upcoming", "Past"].map((item) => <button key={item} type="button" role="tab" aria-selected={period === item} onClick={() => setPeriod(item)}>{item} ({item === "All" ? events.length : events.filter((event) => event.period === item).length})</button>)}</div><section>{visible.map((event) => <article key={event.id}><Link href={`/events/${event.id}`} className="profile-collection-main"><span className="profile-collection-photo"><Image src={event.image} alt="" fill sizes="150px" className="object-cover" unoptimized={event.image.startsWith("http")} /></span><div><small>{formatDate(event.startsAt)}</small><h2>{event.title}</h2><span><DiscoverIcon name="pin" />{event.location}</span><span className="profile-collection-going"><DiscoverIcon name="users" /><em>{event.count} going</em></span></div></Link><button type="button" className="profile-collection-unsave" aria-label={`Unsave ${event.title}`} onClick={() => toggleSaved(event.id)}><DiscoverIcon name="heart" filled /></button><footer className="profile-collection-actions"><Link href={`/events/${event.id}`}><DiscoverIcon name="eye" />Details</Link><Link href={event.action === "going" ? "/tickets" : event.action === "buy" ? `/events/${event.id}/tickets` : `/events/${event.id}/rsvp`} className="profile-collection-primary">{event.action === "going" ? <><DiscoverIcon name="check" />Going</> : event.action === "buy" ? <><DiscoverIcon name="ticket" />Buy Ticket</> : <><DiscoverIcon name="users" />RSVP</>}</Link></footer></article>)}{loading ? <p className="profile-collection-empty">Loading saved events…</p> : !visible.length && <p className="profile-collection-empty">No saved events in this section.</p>}</section></div>;
}
