"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import type { AppNotification } from "@/types/notification";
import { NotificationIcon } from "./NotificationIcon";
import { useAuthGate } from "@/components/auth/AuthGateProvider";

const filters = ["All", "Unread", "Events", "Tickets", "Affiliates"] as const;
type LoadedNotification = AppNotification & { href?: string };

function notificationSymbol(icon: AppNotification["icon"]): "calendar" | "commission" | "ticket" | "bell" | "profile" | "trend" {
  if (icon === "invite") return "calendar";
  if (icon === "commission") return "commission";
  if (icon === "ticket" || icon === "transfer") return "ticket";
  if (icon === "update") return "bell";
  if (icon === "follow") return "profile";
  return "trend";
}

export function NotificationsScreen() {
  const { requireAuth } = useAuthGate();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [accepted, setAccepted] = useState(false);
  const [items, setItems] = useState<readonly LoadedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void requireAuth({ action: "Log in or create an account to see your notifications.", next: "/notifications" }).then((allowed) => {
      if (!allowed || !active) { setLoading(false); return null; }
      return fetch("/api/notifications").then(async (response) => response.ok ? response.json() : null);
    }).then((result: { notifications?: Array<{ id: string; category: string; title: string; body: string; href: string | null; read_at: string | null; created_at: string }> } | null) => {
      if (!result?.notifications) return;
      setItems(result.notifications.map((item) => ({
        id: item.id, title: item.title, detail: item.body, time: new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-Math.max(0, Math.round((Date.now() - new Date(item.created_at).getTime()) / 3600000)), "hour"),
        day: Date.now() - new Date(item.created_at).getTime() < 86400000 ? "Today" : "Yesterday", category: (filters.includes(item.category as (typeof filters)[number]) ? item.category : "Events") as AppNotification["category"], unread: !item.read_at,
        icon: item.category === "Affiliates" ? "commission" : item.category === "Tickets" ? "ticket" : "invite", href: item.href || undefined,
      })));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requireAuth]);
  const notifications = useMemo(() => items.filter((item) => filter === "All" || filter === "Unread" ? filter === "All" || item.unread : item.category === filter), [filter, items]);

  return <div className="notifications-screen">
    <header className="notifications-header"><h1>Notifications</h1></header>
    <div className="notification-filters" aria-label="Notification filters">{filters.map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}{item === "All" ? ` (${items.length})` : item === "Unread" ? ` (${items.filter((entry) => entry.unread).length})` : ""}</button>)}</div>
    <div className="notification-groups">{(["Today", "Yesterday"] as const).map((day) => {
      const dayItems = notifications.filter((item) => item.day === day);
      if (!dayItems.length) return null;
      return <section key={day} aria-labelledby={`notifications-${day.toLowerCase()}`}><h2 id={`notifications-${day.toLowerCase()}`}>{day}</h2><div>{dayItems.map((item) => <NotificationRow key={item.id} item={item} accepted={accepted} onAccept={() => setAccepted(true)} />)}</div></section>;
    })}{!loading && notifications.length === 0 && <p className="profile-collection-empty">No notifications yet.</p>}</div>
  </div>;
}

function NotificationRow({ item, accepted, onAccept }: { item: LoadedNotification; accepted: boolean; onAccept: () => void }) {
  const actionHref = item.href || (item.action === "invite" ? "/notifications/invitation" : item.action === "ticket-invite" ? "/tickets/invitation" : null);
  const content = <>
    <div className={`notification-symbol is-${item.icon}`}>{item.portrait !== undefined ? <Avatar name={item.title.split(" ")[0]} portrait={item.portrait} size={44} /> : <NotificationIcon name={notificationSymbol(item.icon)} />}{item.portrait !== undefined && <span><NotificationIcon name={item.icon === "follow" ? "profile" : item.icon === "transfer" ? "ticket" : "calendar"} /></span>}</div>
    <div className="notification-copy"><strong>{item.title}</strong>{item.detail && <p>{item.detail}</p>}{item.meta && <small>{item.meta}</small>}</div><time>{item.time}</time>
  </>;
  return <article className={item.unread ? "is-unread" : ""}>
    {actionHref ? <Link href={actionHref} className="notification-row-main">{content}<NotificationIcon name="arrow" /></Link> : <div className="notification-row-main">{content}<NotificationIcon name="arrow" /></div>}
    {item.action === "invite" && <div className="notification-actions"><Link href="/events/palm-grove-sessions">View Event</Link><button type="button" onClick={onAccept}>{accepted ? "Accepted" : "Accept"}</button></div>}
  </article>;
}
