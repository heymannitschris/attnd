"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";
import { Avatar } from "@/components/ui/Avatar";
import type { EarningsSummary } from "@/types/earnings";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { CheckInTeamPanel } from "@/components/dashboard/CheckInTeamPanel";
import { TeamManagementPanel } from "@/components/dashboard/TeamManagementPanel";
import { EventAccessPanel } from "@/components/dashboard/EventAccessPanel";

type DashboardIconName = "chart" | "eye" | "coins" | "wallet" | "qr" | "check" | "download" | "edit";

function DashboardIcon({ name }: { name: DashboardIconName }) {
  const paths = {
    chart: <><path d="M4 20V13h4v7M10 20V8h4v12M16 20V4h4v16" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    coins: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></>,
    wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12" /><path d="M15 11h7v5h-7a2.5 2.5 0 0 1 0-5Z" /></>,
    qr: <><path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 15h2v6h-4v-2" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M4 18v3h16v-3" /></>,
    edit: <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z" /><path d="m13.5 7 3.5 3.5" /></>,
  }[name];
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>;
}

const manageTabs = [
  { label: "Overview", href: "/dashboard/events/mindset-mastery" },
  { label: "Attendees", href: "/dashboard/events/mindset-mastery/attendees" },
  { label: "Earnings", href: "/dashboard/events/mindset-mastery/earnings" },
  { label: "Affiliates", href: "/dashboard/events/mindset-mastery/affiliates" },
  { label: "Live", href: "/dashboard/events/mindset-mastery/live" },
  { label: "Settings", href: "/dashboard/events/mindset-mastery/settings" },
] as const;

const attendees = [
  ["Lukas Weber", "@lukasw", "VIP", "Checked In", "10:12", 0],
  ["Sophie Müller", "@sophiem", "Regular", "Checked In", "10:24", 1],
  ["David Kim", "@davidk", "Early Bird", "Checked In", "10:31", 2],
  ["Emma Rossi", "@emmar", "Regular", "Not Checked In", "–", 3],
  ["Noah Schmidt", "@noahs", "VIP", "Checked In", "10:45", 0],
  ["Mia Chen", "@miachen", "Regular", "Not Checked In", "–", 1],
  ["Jonas Fischer", "@jonasf", "Early Bird", "Checked In", "11:03", 2],
  ["Lea Wagner", "@leaw", "Regular", "Not Checked In", "–", 3],
] as const;

export type CheckInEventSummary = { id: string; slug: string; title: string; coverUrl: string | null; startsAt: string | null; endsAt: string | null; city: string | null; registered: number; capacity: number };
export type RecentCheckIn = { id: string; name: string; tier: string; checkedInAt: string };

function EventSummary({ compact = false, event }: { compact?: boolean; event?: CheckInEventSummary }) {
  const start = event?.startsAt ? new Date(event.startsAt) : null;
  const end = event?.endsAt ? new Date(event.endsAt) : null;
  const cover = event?.coverUrl || "/hosts/lukas-cover.jpg";
  return <section className={`dashboard-event-summary ${compact ? "compact" : ""}`}>
    <span className="dashboard-event-image"><Image src={cover} alt="" fill sizes="160px" className="object-cover" unoptimized={cover.startsWith("http")} /><time><small>{start ? start.toLocaleDateString("en-US", { month: "short" }) : "Oct"}</small><strong>{start ? start.getDate() : "12"}</strong></time></span>
    <div><h2>{event?.title || "Mindset Mastery Workshop"}</h2><p><DiscoverIcon name="calendar" />{start ? start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Sat, Oct 12, 2024"} <span>·</span> {start ? start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "10:00"} – {end ? end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "18:00"}</p><p><DiscoverIcon name="pin" />{event?.city || "Koh Phangan, Thailand"}</p><p><DiscoverIcon name="users" />{event ? `${event.registered} / ${event.capacity}` : "86 / 100"} registered</p></div>
  </section>;
}

function ManageTabs({ active }: { active: string }) {
  return <nav className="dashboard-manage-tabs" aria-label="Manage event sections">{manageTabs.map((tab) => <Link key={tab.label} href={tab.href} aria-current={active === tab.label ? "page" : undefined}>{tab.label}</Link>)}</nav>;
}

function MetricCard({ icon, value, label, trend }: { icon: DashboardIconName | "calendar" | "users" | "ticket"; value: string; label: string; trend?: string }) {
  return <article className="dashboard-metric"><span>{icon === "calendar" || icon === "users" || icon === "ticket" ? <DiscoverIcon name={icon} /> : <DashboardIcon name={icon} />}</span><strong>{value}</strong><p>{label}</p>{trend && <small>{trend}</small>}</article>;
}

const earningsMoney = (minor: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);

function useHostEarnings(source: "host" | "cohost" | "team") {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  useEffect(() => {
    void fetch(`/api/earnings?source=${source}`).then(async (response) => response.ok ? response.json() : null)
      .then((data: EarningsSummary | null) => setSummary(data)).catch(() => setSummary(null));
  }, [source]);
  return summary;
}

function HostEarningsOverview() {
  const summary = useHostEarnings("host");
  const cohostSummary = useHostEarnings("cohost");
  const teamSummary = useHostEarnings("team");
  const [period, setPeriod] = useState(30);
  const [currency, setCurrency] = useState("thb");
  const balance = summary?.balances.find((item) => item.currency === currency) || summary?.balances[0];
  const displayCurrency = balance?.currency || currency;
  const chart = Array.from({ length: 14 }, (_, index) => {
    const end = Date.now() - (13 - index) * period / 14 * 86400000;
    const start = end - period / 14 * 86400000;
    return (summary?.activity || []).filter((item) => item.currency === displayCurrency && new Date(item.createdAt).getTime() >= start && new Date(item.createdAt).getTime() < end).reduce((sum, item) => sum + item.amountMinor, 0);
  });
  const highest = Math.max(1, ...chart);
  return <div className="dashboard-root-earnings">
    {summary && summary.balances.length > 1 && <label className="dashboard-earnings-currency">Currency <select value={displayCurrency} onChange={(event) => setCurrency(event.target.value)}>{summary.balances.map((item) => <option key={item.currency} value={item.currency}>{item.currency.toUpperCase()}</option>)}</select></label>}
    <section className="dashboard-metrics three"><MetricCard icon="coins" value={balance ? earningsMoney(balance.totalMinor, displayCurrency) : "—"} label="Host Earnings" /><MetricCard icon="wallet" value={balance ? earningsMoney(balance.availableMinor, displayCurrency) : "—"} label="Available" trend="After event and payment hold" /><MetricCard icon="chart" value={balance ? earningsMoney(balance.pendingMinor, displayCurrency) : "—"} label="Pending" /></section>
    <Link href={`/dashboard/withdraw?currency=${displayCurrency}`} className="dashboard-host-withdraw">Withdraw Funds</Link>
    <section className="dashboard-additional-earnings" aria-label="Additional earnings">
      <article><div><span>Co-Host Earnings</span><strong>{cohostSummary?.balances.map((item) => earningsMoney(item.totalMinor, item.currency)).join(" · ") || "—"}</strong><small>{cohostSummary?.balances.map((item) => `${earningsMoney(item.availableMinor, item.currency)} available`).join(" · ") || "No available balance yet"}</small></div><Link href={`/dashboard/withdraw?source=cohost&currency=${cohostSummary?.balances[0]?.currency || "thb"}`}>Withdraw</Link></article>
      <article><div><span>Team Earnings</span><strong>{teamSummary?.balances.map((item) => earningsMoney(item.totalMinor, item.currency)).join(" · ") || "—"}</strong><small>{teamSummary?.balances.map((item) => `${earningsMoney(item.availableMinor, item.currency)} available`).join(" · ") || "No available balance yet"}</small></div><Link href={`/dashboard/withdraw?source=team&currency=${teamSummary?.balances[0]?.currency || "thb"}`}>Withdraw</Link></article>
    </section>
    <section className="dashboard-host-chart"><header><h2>Earnings Overview</h2><select aria-label="Earnings period" value={period} onChange={(event) => setPeriod(Number(event.target.value))}><option value={30}>Last 30 Days</option><option value={90}>Last 90 Days</option><option value={365}>Last Year</option></select></header><div>{chart.map((amount, index) => <i key={index} aria-label={`${earningsMoney(amount, displayCurrency)} in period ${index + 1}`} style={{ height: `${Math.max(3, amount / highest * 100)}%` }} />)}</div><footer><span>{new Date(Date.now() - period * 86400000).toLocaleDateString()}</span><span>Today</span></footer></section>
    <section className="dashboard-host-event-earnings"><header><h2>Earnings by Event</h2></header>{summary?.byEvent.map((event) => { const value = event.currencies.find((item) => item.currency === displayCurrency); return value ? <Link href={`/events/${event.slug}`} key={event.id}><Image src={event.coverUrl || "/events/gallery-friends.jpg"} alt="" width={54} height={44} unoptimized={Boolean(event.coverUrl?.startsWith("http") && !event.coverUrl.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`))} /><p><strong>{event.title}</strong><small>{value.sales} paid orders</small></p><b>{earningsMoney(value.amountMinor, displayCurrency)}</b><DiscoverIcon name="chevron" /></Link> : null; })}{summary && !summary.byEvent.length && <p className="dashboard-empty">No paid event sales yet.</p>}</section>
    <section className="dashboard-host-payout-list"><header><h2>Payout History</h2><Link href="/dashboard/payouts">See All <DiscoverIcon name="arrow" /></Link></header>{summary?.payouts.filter((row) => row.currency === displayCurrency).slice(0, 3).map((row) => <article key={row.id}><span><DashboardIcon name="wallet" /></span><p><strong>{earningsMoney(row.amount_minor, row.currency)}</strong><small>Stripe Connect · {new Date(row.created_at).toLocaleDateString()}</small></p><b data-status={row.status}>{row.status === "paid" ? "Transferred" : row.status}</b></article>)}{summary && !summary.payouts.length && <p className="dashboard-empty">No payouts yet.</p>}</section>
  </div>;
}

type HostEventSummary = { id: string; slug: string; title: string; status: string; startsAt: string | null; image: string | null };
const dashboardSections = [
  { label: "Overview", tabs: ["Overview"] },
  { label: "Events", tabs: ["Events"] },
  { label: "Earnings", tabs: ["Earnings"] },
  { label: "People", tabs: ["Team", "Co-Hosting", "Check-in Team"] },
  { label: "Access", tabs: ["Guestlist", "Local Membership"] },
  { label: "More", tabs: ["Waitlist & Refunds", "Tools"] },
] as const;
type CohostingRow = { eventId: string; event: { slug: string; title: string } | null; status: string; sharePercent: number; earnedMinor: number; currency: string };
type HostCohostRow = { user_id: string; status: string; revenue_share_percent: number; profiles: { first_name: string | null; username: string | null } | null };
type DashboardOperations = {
  event: { id: string; slug: string; title: string; status: string; starts_at: string | null; cover_url: string | null; venue_name: string | null; city: string | null };
  summary: { capacity: number; attendees: number; checkedIn: number; paidOrders: number; refundedOrders: number; revenueByCurrency: Array<{ currency: string; amountMinor: number }>; waitlist: number; offers: number; team: number; checkInStaff: number; guestlist: number; openRefunds: number };
  tiers: Array<{ id: string; name: string; price_minor: number; currency: string; quantity: number; sold_count: number; reserved_count: number; active: boolean }>;
  waitlist: Array<{ id: string; quantity: number; status: "waiting" | "offered"; offer_expires_at: string | null; created_at: string; profiles: { first_name: string | null; username: string | null } | null; ticket_types: { name: string } | null }>;
  refunds: Array<{ id: string; reason: string; status: string; created_at: string; requester: { first_name: string | null; username: string | null } | null; orders: { total_minor: number; currency: string } | null }>;
  localRule: { enabled: boolean; locality: string; benefit_type: "free" | "percentage"; discount_percent: number; capacity: number | null; redeemed_count: number } | null;
};

function DashboardEventSelector({ events, value, onChange, floating = false }: { events: HostEventSummary[]; value: string; onChange: (id: string) => void; floating?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!events.length) return null;
  const selected = events.find((event) => event.id === value) || events[0];
  return <div className={`dashboard-event-selector${floating ? " dashboard-event-switcher" : ""}`}>{!floating && <span>Event</span>}<button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span><strong>{selected.title}</strong><small>{selected.status} · Tap to switch event</small></span><DiscoverIcon name="chevron" /></button>{open && <><button type="button" className="dashboard-event-selector-backdrop" aria-label="Close event selection" onClick={() => setOpen(false)} /><div className="dashboard-event-selector-menu" role="listbox" aria-label="Choose event">{events.map((event) => <button type="button" role="option" aria-selected={event.id === value} key={event.id} onClick={() => { onChange(event.id); setOpen(false); }}><span><strong>{event.title}</strong><small>{event.status}</small></span>{event.id === value && <DiscoverIcon name="check" />}</button>)}</div></>}</div>;
}

function EventOperations({ data, loading }: { data: DashboardOperations | null; loading: boolean }) {
  if (loading) return <section className="dashboard-panel dashboard-operations-loading">Loading live event data…</section>;
  if (!data) return <section className="dashboard-panel dashboard-operations-loading">Event data could not be loaded.</section>;
  const localBenefit = !data.localRule?.enabled ? "Not active" : data.localRule.benefit_type === "free" ? `Free for ${data.localRule.locality}` : `${data.localRule.discount_percent}% off for ${data.localRule.locality}`;
  return <>
    <section className="dashboard-metrics four dashboard-live-metrics">
      <MetricCard icon="users" value={`${data.summary.attendees}${data.summary.capacity ? ` / ${data.summary.capacity}` : ""}`} label="Attendees" />
      <MetricCard icon="coins" value={data.summary.revenueByCurrency.map((item) => earningsMoney(item.amountMinor, item.currency)).join(" · ") || "—"} label="Ticket Revenue" trend={`${data.summary.paidOrders} paid orders`} />
      <MetricCard icon="check" value={String(data.summary.checkedIn)} label="Checked In" trend={`${data.summary.checkInStaff} door staff`} />
      <MetricCard icon="ticket" value={String(data.summary.waitlist)} label="Waitlist" trend={`${data.summary.offers} active offers`} />
    </section>
    <section className="dashboard-ops-snapshot">
      <article><span>Team</span><strong>{data.summary.team}</strong><small>accepted members</small></article>
      <article><span>Guestlist</span><strong>{data.summary.guestlist}</strong><small>passes including +1s</small></article>
      <article><span>Refunds</span><strong>{data.summary.openRefunds}</strong><small>open requests</small></article>
      <article><span>Local benefit</span><strong>{localBenefit}</strong><small>{data.localRule?.enabled ? `${data.localRule.redeemed_count} redeemed` : "Configure in Local Membership"}</small></article>
    </section>
  </>;
}

function WaitlistAndRefunds({ data, loading }: { data: DashboardOperations | null; loading: boolean }) {
  if (loading) return <section className="dashboard-panel dashboard-operations-loading">Loading waitlist and refunds…</section>;
  if (!data) return <section className="dashboard-panel dashboard-operations-loading">Event data could not be loaded.</section>;
  return <div className="dashboard-ops-grid">
    <section className="dashboard-panel dashboard-ops-list"><header><h2>Waitlist</h2><span>{data.summary.waitlist} waiting · {data.summary.offers} offered</span></header>{data.waitlist.map((entry) => <article key={entry.id}><div><strong>{entry.profiles?.first_name || entry.profiles?.username || "Guest"}</strong><small>{entry.ticket_types?.name || "Ticket"} · {entry.quantity} {entry.quantity === 1 ? "place" : "places"}</small></div><b data-status={entry.status}>{entry.status === "offered" ? "Offer sent" : "Waiting"}</b>{entry.status === "offered" && entry.offer_expires_at && <time>Expires {new Date(entry.offer_expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>}</article>)}{!data.waitlist.length && <p className="dashboard-empty">No one is waiting for this event.</p>}</section>
    <section className="dashboard-panel dashboard-ops-list"><header><h2>Refund requests</h2><span>{data.summary.openRefunds} require attention</span></header>{data.refunds.map((refund) => <article key={refund.id}><div><strong>{refund.requester?.first_name || refund.requester?.username || "Guest"}</strong><small>{refund.reason}</small></div><b data-status={refund.status}>{refund.status.replaceAll("_", " ")}</b><time>{refund.orders ? earningsMoney(refund.orders.total_minor, refund.orders.currency) : ""}</time></article>)}{!data.refunds.length && <p className="dashboard-empty">No refund requests for this event.</p>}</section>
    <section className="dashboard-panel dashboard-ops-list dashboard-inventory"><header><h2>Ticket inventory</h2><span>{data.summary.refundedOrders} refunded orders</span></header>{data.tiers.map((tier) => <article key={tier.id}><div><strong>{tier.name}</strong><small>{earningsMoney(tier.price_minor, tier.currency)}</small></div><b>{tier.sold_count} / {tier.quantity} sold</b><time>{Math.max(0, tier.quantity - tier.sold_count - tier.reserved_count)} available</time></article>)}{!data.tiers.length && <p className="dashboard-empty">No ticket types created yet.</p>}</section>
  </div>;
}

export function HostDashboardOverview({ initialTab = "Overview", hostEvents = [] }: { initialTab?: string; hostEvents?: HostEventSummary[] }) {
  const [tab, setTab] = useState(initialTab);
  const [events, setEvents] = useState(hostEvents);
  const [selectedEventId, setSelectedEventId] = useState(hostEvents[0]?.id || "");
  const [operations, setOperations] = useState<DashboardOperations | null>(null);
  const [operationsLoading, setOperationsLoading] = useState(Boolean(hostEvents.length));
  const [cohosting, setCohosting] = useState<CohostingRow[]>([]);
  const [cohostUsername, setCohostUsername] = useState("");
  const [cohostShare, setCohostShare] = useState("0");
  const [cohostEventId, setCohostEventId] = useState(hostEvents[0]?.id || "");
  const [cohostNotice, setCohostNotice] = useState("");
  const [hostTeam, setHostTeam] = useState<HostCohostRow[]>([]);
  const [deleteEventId, setDeleteEventId] = useState("");
  const [eventNotice, setEventNotice] = useState("");
  const [deletingEvent, setDeletingEvent] = useState(false);
  const activeSection = dashboardSections.find((section) => section.tabs.includes(tab as never)) || dashboardSections[0];
  useEffect(() => {
    if (!selectedEventId) { setOperations(null); setOperationsLoading(false); return; }
    const controller = new AbortController();
    setOperationsLoading(true);
    void fetch(`/api/host/dashboard?eventId=${encodeURIComponent(selectedEventId)}`, { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<DashboardOperations> : null)
      .then((data) => { if (data) setOperations(data); else setOperations(null); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setOperations(null); })
      .finally(() => { if (!controller.signal.aborted) setOperationsLoading(false); });
    return () => controller.abort();
  }, [selectedEventId]);
  useEffect(() => { if (tab === "Co-Hosting") void fetch("/api/cohosts").then((response) => response.json()).then((data: { cohosting?: CohostingRow[] }) => setCohosting(data.cohosting || [])).catch(() => {}); }, [tab]);
  useEffect(() => { if (tab === "Co-Hosting" && cohostEventId) void fetch(`/api/cohosts?eventId=${encodeURIComponent(cohostEventId)}`).then((response) => response.json()).then((data: { team?: HostCohostRow[] }) => setHostTeam(data.team || [])).catch(() => {}); }, [tab, cohostEventId, cohostNotice]);
  useEffect(() => { if (selectedEventId) setCohostEventId(selectedEventId); }, [selectedEventId]);
  async function respondToCohost(eventId: string, status: "accepted" | "declined") {
    const response = await fetch("/api/cohosts", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, status }) });
    if (response.ok) setCohosting((rows) => rows.map((row) => row.eventId === eventId ? { ...row, status } : row));
  }
  async function inviteCohost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCohostNotice("");
    const response = await fetch("/api/cohosts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: cohostEventId, username: cohostUsername, sharePercent: Number(cohostShare) }) });
    const result = await response.json() as { error?: string };
    setCohostNotice(response.ok ? "Co-host invitation sent." : result.error || "Invitation failed.");
    if (response.ok) setCohostUsername("");
  }
  async function deleteEvent(id: string) {
    setDeletingEvent(true); setEventNotice("");
    const response = await fetch(`/api/events?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json() as { error?: string };
    if (response.ok) {
      const remaining = events.filter((event) => event.id !== id);
      setEvents(remaining); setDeleteEventId(""); setEventNotice("Event deleted.");
      if (selectedEventId === id) setSelectedEventId(remaining[0]?.id || "");
    } else setEventNotice(result.error || "Event could not be deleted.");
    setDeletingEvent(false);
  }
  return <div className="host-dashboard-screen">
    <header className="dashboard-titlebar"><h1>Host Dashboard</h1><span aria-hidden="true" /></header>
    <div role="tablist" className="dashboard-root-tabs dashboard-primary-tabs">{dashboardSections.map((section) => <button key={section.label} type="button" role="tab" aria-selected={activeSection.label === section.label} onClick={() => setTab(section.tabs[0])}>{section.label}</button>)}</div>
    {activeSection.tabs.length > 1 && <div role="tablist" className="dashboard-subtabs">{activeSection.tabs.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>)}</div>}
    {tab === "Overview" ? <>
      {events.length ? <EventOperations data={operations} loading={operationsLoading} /> : <section className="dashboard-panel dashboard-operations-loading">Create your first event to see live operations here.</section>}
      <section className="dashboard-tool-grid"><button type="button" onClick={() => setTab("Earnings")}><DashboardIcon name="chart" /><p><strong>View Earnings</strong><span>See paid sales and available balance.</span></p><DiscoverIcon name="chevron" /></button><button type="button" onClick={() => setTab("Co-Hosting")}><DiscoverIcon name="users" /><p><strong>Invite Co-Hosts</strong><span>Collaborate and split revenue.</span></p><DiscoverIcon name="chevron" /></button><button type="button" onClick={() => setTab("Team")}><DiscoverIcon name="users" /><p><strong>Team Management</strong><span>Assign roles and automate compensation.</span></p><DiscoverIcon name="chevron" /></button><button type="button" onClick={() => setTab("Check-in Team")}><DashboardIcon name="qr" /><p><strong>Check-in Team</strong><span>Give door staff scanner access.</span></p><DiscoverIcon name="chevron" /></button><button type="button" onClick={() => setTab("Guestlist")}><DiscoverIcon name="users" /><p><strong>Guestlist</strong><span>Add invited guests and track arrivals.</span></p><DiscoverIcon name="chevron" /></button><button type="button" onClick={() => setTab("Local Membership")}><DiscoverIcon name="pin" /><p><strong>Local Membership</strong><span>Offer verified locals free or discounted entry.</span></p><DiscoverIcon name="chevron" /></button></section>
    </> : tab === "Events" ? <section className="dashboard-all-events"><header className="dashboard-events-header"><h2>Your Events</h2><Link href="/create"><span aria-hidden="true">＋</span>Add Event</Link></header>{events.map((event) => <article key={event.id}><Link href={`/events/${event.slug}`} className="dashboard-event-main"><Image src={event.image || "/placeholders/black.svg"} alt="" width={76} height={58} /><p><strong>{event.title}</strong><span>{event.startsAt ? new Date(event.startsAt).toLocaleDateString() : "Date not set"}</span></p><b data-status={event.status}>{event.status}</b></Link><div className="dashboard-event-row-actions"><Link href={`/create?id=${event.id}`}><DashboardIcon name="edit" />Edit</Link><Link href={`/create?id=${event.id}&step=date&relist=1`}><DiscoverIcon name="calendar" />Relist</Link><button type="button" onClick={() => { setDeleteEventId(event.id); setEventNotice(""); }}><DiscoverIcon name="x" />Delete</button></div>{deleteEventId === event.id && <div className="dashboard-delete-confirm"><p>Delete “{event.title}”? This cannot be undone.</p><button type="button" disabled={deletingEvent} onClick={() => void deleteEvent(event.id)}>{deletingEvent ? "Deleting…" : "Delete event"}</button><button type="button" onClick={() => setDeleteEventId("")}>Keep event</button></div>}</article>)}{eventNotice && <p className="dashboard-event-notice" role="status">{eventNotice}</p>}{!events.length && <p className="dashboard-empty">No events yet.</p>}</section> : tab === "Earnings" ? <HostEarningsOverview /> : tab === "Co-Hosting" ? <section className="dashboard-cohosting"><h2>Events You Co-Host</h2>{cohosting.length ? cohosting.map((row) => <article key={row.eventId}><div><Link href={row.event ? `/events/${row.event.slug}` : "#"}>{row.event?.title || "Event"}</Link><small>{row.status === "accepted" ? `${row.sharePercent}% revenue share` : "Invitation pending"}</small></div>{row.status === "pending" ? <div className="dashboard-cohost-actions"><button type="button" onClick={() => void respondToCohost(row.eventId, "accepted")}>Accept</button><button type="button" onClick={() => void respondToCohost(row.eventId, "declined")}>Decline</button></div> : <strong>{earningsMoney(row.earnedMinor, row.currency)}<small>Earned</small></strong>}</article>) : <p>No co-host invitations yet.</p>}<h2>Invite a Co-Host</h2><form onSubmit={(event) => void inviteCohost(event)}><label>Username<input value={cohostUsername} onChange={(event) => setCohostUsername(event.target.value)} placeholder="@username" required /></label><label>Revenue share (%)<input type="number" min="0" max="100" value={cohostShare} onChange={(event) => setCohostShare(event.target.value)} required /></label><button type="submit" disabled={!events.length}>Send Invitation</button>{cohostNotice && <p role="status">{cohostNotice}</p>}</form>{events.length > 0 && <><h2>Your Co-Hosts</h2>{hostTeam.length ? hostTeam.map((person) => <article key={person.user_id}><div><Link href={`/people/${person.user_id}`}>{person.profiles?.first_name || person.profiles?.username || "Co-Host"}</Link><small>{person.status}</small></div><strong>{person.revenue_share_percent}%<small>Revenue share</small></strong></article>) : <p>No co-hosts for this event yet.</p>}</>}</section> : tab === "Team" ? <TeamManagementPanel hostEvents={events} activeEventId={selectedEventId} /> : tab === "Check-in Team" ? <CheckInTeamPanel hostEvents={events} activeEventId={selectedEventId} /> : tab === "Guestlist" ? <EventAccessPanel hostEvents={events} mode="guestlist" activeEventId={selectedEventId} /> : tab === "Local Membership" ? <EventAccessPanel hostEvents={events} mode="locals" activeEventId={selectedEventId} /> : tab === "Waitlist & Refunds" ? <WaitlistAndRefunds data={operations} loading={operationsLoading} /> : <section className="dashboard-tool-grid dashboard-real-tools">{operations ? <><Link href={`/create?id=${operations.event.id}`}><DashboardIcon name="edit" /><p><strong>Edit Event</strong><span>Update details, dates and ticket types.</span></p><DiscoverIcon name="chevron" /></Link><Link href={`/create?id=${operations.event.id}&step=date&relist=1`}><DiscoverIcon name="calendar" /><p><strong>Relist Event</strong><span>Set a new date and keep reviews and gallery.</span></p><DiscoverIcon name="chevron" /></Link><Link href={`/dashboard/events/${operations.event.id}/check-in`}><DashboardIcon name="qr" /><p><strong>Open Scanner</strong><span>Scan tickets and guestlist passes.</span></p><DiscoverIcon name="chevron" /></Link><Link href={`/events/${operations.event.slug}`}><DiscoverIcon name="eye" /><p><strong>View Event</strong><span>Open the public event page.</span></p><DiscoverIcon name="chevron" /></Link><button type="button" onClick={() => setTab("Waitlist & Refunds")}><DiscoverIcon name="ticket" /><p><strong>Waitlist & Refunds</strong><span>See offers, inventory and requests.</span></p><DiscoverIcon name="chevron" /></button></> : <p className="dashboard-empty">Select or create an event first.</p>}</section>}
    <DashboardEventSelector events={events} value={selectedEventId} onChange={setSelectedEventId} floating />
  </div>;
}

export function ManageEventDashboard() {
  const [salesPeriod, setSalesPeriod] = useState("30");
  const chartPath = salesPeriod === "7" ? "M10 125C90 118 150 130 215 92s105 2 160-28 105 10 215-48" : salesPeriod === "90" ? "M10 140C65 132 105 120 150 124s80-35 130-31 76-30 120-38 72-19 105-25 54-17 85-22" : "M10 135C80 130 90 115 150 110S230 85 280 80s70-25 120-24 70-20 105-22 55-24 85-26";
  return <div className="host-dashboard-screen manage-dashboard-screen"><header className="dashboard-page-header"><Link href="/dashboard" aria-label="Back"><DiscoverIcon name="chevron" /></Link><h1>Manage Event</h1><span /></header><EventSummary /><div className="dashboard-event-actions"><Link href="/create"><DashboardIcon name="edit" />Edit Event</Link><Link href="/dashboard/events/mindset-mastery/check-in"><DashboardIcon name="qr" />Check In</Link></div><ManageTabs active="Overview" />
    <section className="dashboard-metrics three"><MetricCard icon="users" value="86 / 100" label="Attendees" trend="86% sold" /><MetricCard icon="ticket" value="$2,580" label="Ticket Revenue" trend="▲ +28%" /><MetricCard icon="chart" value="4,320" label="Total Views" trend="▲ +42%" /></section>
    <section className="dashboard-panel dashboard-chart"><div className="dashboard-panel-title"><h2>Ticket Sales</h2><select aria-label="Ticket sales period" value={salesPeriod} onChange={(event) => setSalesPeriod(event.target.value)}><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option></select></div><svg viewBox="0 0 600 150" role="img" aria-label="Ticket sales by selected period"><path d={chartPath} fill="none" stroke="currentColor" strokeWidth="4" /><path d={chartPath + "V145H10Z"} fill="currentColor" opacity=".09" /></svg></section>
    <div className="dashboard-split"><section className="dashboard-panel dashboard-ticket-types"><div className="dashboard-panel-title"><h2>Ticket Types</h2><Link href="/create?step=tickets">Manage</Link></div>{[["Early Bird", "$29.00", "32 / 50 sold"], ["Regular", "$49.00", "42 / 50 sold"], ["VIP", "$99.00", "12 / 20 sold"]].map((ticket) => <div key={ticket[0]}><p><strong>{ticket[0]}</strong><span>{ticket[1]}</span></p><p><span>{ticket[2]}</span><i /></p><DiscoverIcon name="chevron" /></div>)}</section><section className="dashboard-panel dashboard-quick-actions"><h2>Quick Actions</h2><Link href="/dashboard/events/mindset-mastery/attendees"><DiscoverIcon name="users" />View Attendees</Link><Link href="/dashboard/events/mindset-mastery/check-in"><DashboardIcon name="qr" />Check-in (QR Scanner)</Link><button><DiscoverIcon name="send" />Send Update</button><button><DiscoverIcon name="calendar" />Duplicate Event</button></section></div>
  </div>;
}

export function CohostDashboardPreview() {
  return <div className="host-dashboard-screen">
    <header className="dashboard-titlebar"><h1>Host Dashboard</h1><Link href="/create">＋ <b>Create Event</b></Link></header>
    <div role="tablist" className="dashboard-root-tabs">{["Overview", "Events", "Earnings", "Co-Hosting", "Tools"].map((item) => <button key={item} type="button" role="tab" aria-selected={item === "Co-Hosting"}>{item}</button>)}</div>
    <section className="dashboard-cohosting">
      <h2>Co-Host Team</h2>
      <article><div><Link href="/people/lukas-m">Lukas M.</Link><small>Mindset Mastery Workshop · accepted</small></div><strong>25%<small>Revenue share</small></strong></article>
      <article><div><Link href="/people/sophie-k">Sophie K.</Link><small>Jungle Experience · accepted</small></div><strong>15%<small>Revenue share</small></strong></article>
      <h2>Events You Co-Host</h2>
      <article><div><Link href="/events/sunset-breathwork">Sunset Breathwork</Link><small>20% revenue share</small></div><strong>฿4,800<small>Earned</small></strong></article>
      <h2>Invite a Co-Host</h2>
      <form><label>Event<select defaultValue="mindset"><option value="mindset">Mindset Mastery Workshop</option></select></label><label>Username<input defaultValue="@maya" readOnly /></label><label>Revenue share (%)<input defaultValue="20" readOnly /></label><button type="button">Send Invitation</button></form>
    </section>
  </div>;
}

export function TeamDashboardPreview() {
  return <div className="host-dashboard-screen">
    <header className="dashboard-titlebar"><h1>Host Dashboard</h1><Link href="/create">＋ <b>Create Event</b></Link></header>
    <div role="tablist" className="dashboard-root-tabs">{["Overview", "Events", "Earnings", "Co-Hosting", "Team", "Check-in"].map((item) => <button key={item} type="button" role="tab" aria-selected={item === "Team"}>{item}</button>)}</div>
    <section className="dashboard-cohosting dashboard-team-management">
      <h2>Event Team</h2>
      <article><div><Link href="#">Maya Chen</Link><small>Security · accepted · Check-in access</small></div><strong>10%<small>Revenue share</small></strong></article>
      <article><div><Link href="#">Alex Rivera</Link><small>Cleaning · accepted</small></div><strong>฿3,500<small>Fixed fee</small></strong></article>
      <article><div><Link href="#">Noah Schmidt</Link><small>Event Management · pending</small></div><strong>15%<small>Revenue share</small></strong></article>
      <h2>Automated Compensation</h2>
      <div className="dashboard-cohost-balance"><strong>฿12,420</strong><small>Funded from event revenue</small><span>฿8,920 ready after the event hold</span></div>
    </section>
  </div>;
}

export function GuestlistDashboardPreview() {
  return <div className="host-dashboard-screen">
    <header className="dashboard-titlebar"><h1>Host Dashboard</h1><Link href="#">＋ <b>Add Guest</b></Link></header>
    <div role="tablist" className="dashboard-root-tabs">{["Overview", "Events", "Team", "Check-in", "Guestlist"].map((item) => <button key={item} type="button" role="tab" aria-selected={item === "Guestlist"}>{item}</button>)}</div>
    <section className="dashboard-cohosting dashboard-team-management dashboard-access-panel">
      <h2>Guestlist <small>42 guests</small></h2>
      <label>Event<select defaultValue="jungle"><option value="jungle">Jungle Experience</option></select></label>
      {[{ name: "Maya Chen", detail: "@mayac · +1", status: "Arrived" }, { name: "Lukas Weber", detail: "Artist list · +2", status: "Invited" }, { name: "Sophie Müller", detail: "VIP guest", status: "Arrived" }, { name: "Emma Rossi", detail: "@emmar", status: "Invited" }].map((guest, index) => <article key={guest.name}><div><span style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={guest.name} portrait={index} size={34} /><strong>{guest.name}</strong></span><small>{guest.detail}</small></div><b data-status={guest.status.toLowerCase()}>{guest.status === "Arrived" ? "✓ Arrived" : guest.status}</b></article>)}
      <form><label>Guest name<input defaultValue="Noah Schmidt" readOnly /></label><label>Plus ones<input defaultValue="1" readOnly /></label><button type="button">Add to Guestlist</button></form>
    </section>
  </div>;
}

export function LocalMembershipDashboardPreview() {
  return <div className="host-dashboard-screen">
    <header className="dashboard-titlebar"><h1>Host Dashboard</h1><Link href="#"><b>Save Benefit</b></Link></header>
    <div role="tablist" className="dashboard-root-tabs">{["Overview", "Events", "Guestlist", "Local Membership"].map((item) => <button key={item} type="button" role="tab" aria-selected={item === "Local Membership"}>{item}</button>)}</div>
    <section className="dashboard-cohosting dashboard-team-management dashboard-access-panel">
      <h2>Local Membership</h2>
      <div className="dashboard-cohost-balance"><strong>25% OFF</strong><small>Verified Koh Phangan locals</small><span>18 of 50 benefits redeemed</span></div>
      <form><label>Local area<input defaultValue="Koh Phangan" readOnly /></label><label>Benefit<select defaultValue="discount"><option value="discount">Discounted entry</option><option>Free entry</option></select></label><label>Discount (%)<input defaultValue="25" readOnly /></label><button type="button">Save Local Benefit</button></form>
      <h2>Verified Locals</h2>
      {["Maya Chen", "David Kim", "Emma Rossi"].map((name, index) => <article key={name}><div><span style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={name} portrait={index + 1} size={34} /><strong>{name}</strong></span><small>Koh Phangan · verified</small></div><b data-status="verified">✓ Local</b></article>)}
    </section>
  </div>;
}

export function AttendeesDashboard() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const visible = useMemo(() => attendees.filter((person) => (filter === "All" || person[3] === filter) && person[0].toLowerCase().includes(search.toLowerCase())), [filter, search]);
  return <div className="host-dashboard-screen manage-dashboard-screen"><header className="dashboard-page-header"><Link href="/dashboard/events/mindset-mastery" aria-label="Back"><DiscoverIcon name="chevron" /></Link><h1>Attendees</h1><Link href="/dashboard/events/mindset-mastery/check-in"><DashboardIcon name="qr" /> Check-in</Link></header><EventSummary /><ManageTabs active="Attendees" /><section className="dashboard-metrics four attendee"><MetricCard icon="users" value="86" label="Total Attendees" /><MetricCard icon="check" value="62" label="Checked In" trend="72%" /><MetricCard icon="calendar" value="24" label="Not Checked In" trend="28%" /><MetricCard icon="ticket" value="0" label="Waitlist" /></section>
    <label className="dashboard-search"><DiscoverIcon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search attendees..." /></label><div className="dashboard-filters">{["All", "Checked In", "Not Checked In"].map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div>
    <section className="dashboard-attendee-table">{visible.map((person) => <article key={person[0]}><Avatar name={person[0]} portrait={person[5]} size={44} /><p><strong>{person[0]}</strong><small>{person[1]}</small></p><div><span>{person[2]}</span><b data-status={person[3]}>{person[3] === "Checked In" ? "✓ Checked In" : "Not Checked In"}</b></div><DiscoverIcon name="chevron" /></article>)}</section><div className="dashboard-export"><button><DashboardIcon name="download" />Export Attendees</button><button><DiscoverIcon name="send" />Send Message to All</button></div>
  </div>;
}

export function CheckInDashboard({ previewCameraActive = false, event, initialCheckIns = [] }: { previewCameraActive?: boolean; event?: CheckInEventSummary; initialCheckIns?: RecentCheckIn[] } = {}) {
  const [scanResult, setScanResult] = useState("");
  const [cameraError, setCameraError] = useState("Allow camera access to scan ticket QR codes.");
  const [cameraReady, setCameraReady] = useState(previewCameraActive);
  const [cameraPending, setCameraPending] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [recentCheckIns, setRecentCheckIns] = useState(initialCheckIns);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const checkingRef = useRef(false);
  const requestNativeCameraPermission = useCallback(async () => {
    const handler = (window as Window & { webkit?: { messageHandlers?: { attndCameraPermission?: { postMessage: (value: unknown) => void } } } }).webkit?.messageHandlers?.attndCameraPermission;
    if (!handler) return true;
    return await new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => { window.removeEventListener("attnd-native-camera", receive); resolve(false); }, 12000);
      const receive = (event: Event) => {
        window.clearTimeout(timeout);
        window.removeEventListener("attnd-native-camera", receive);
        resolve(Boolean((event as CustomEvent<{ granted?: boolean }>).detail?.granted));
      };
      window.addEventListener("attnd-native-camera", receive);
      handler.postMessage({ action: "request" });
    });
  }, []);
  const startCamera = useCallback(async (): Promise<MediaStream | null> => {
    try {
      setCameraPending(true);
      const nativePermissionGranted = await requestNativeCameraPermission();
      if (!nativePermissionGranted) throw new Error("camera-permission-denied");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraError("");
      setCameraReady(true);
      return stream;
    } catch {
      setCameraReady(false);
      setCameraError("Camera access was not granted. Enable it in iOS Settings and try again.");
      return null;
    } finally {
      setCameraPending(false);
    }
  }, [requestNativeCameraPermission]);
  const toggleTorch = async () => {
    const stream = streamRef.current ?? await startCamera();
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      const nativeHandler = (window as Window & { webkit?: { messageHandlers?: { attndTorch?: { postMessage: (value: unknown) => void } } } }).webkit?.messageHandlers?.attndTorch;
      const next = !torchOn;
      if (nativeHandler) {
        nativeHandler.postMessage({ enabled: next });
        return;
      }
      const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
      if (!capabilities.torch) return setCameraError("Flash is not available on this camera.");
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
      setCameraError("");
    } catch {
      setCameraError("Flash could not be enabled on this device.");
    }
  };
  useEffect(() => {
    const receiveTorchState = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean; error?: boolean }>).detail;
      if (detail?.error) return setCameraError("Flash could not be enabled on this device.");
      setTorchOn(Boolean(detail?.enabled));
      setCameraError("");
    };
    window.addEventListener("attnd-native-torch", receiveTorchState);
    return () => {
      window.removeEventListener("attnd-native-torch", receiveTorchState);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => {
    if (previewCameraActive || !cameraReady || !videoRef.current) return;
    let disposed = false;
    const reader = new BrowserQRCodeReader();
    void reader.decodeFromVideoElement(videoRef.current, (result) => {
      if (!result || disposed || checkingRef.current) return;
      checkingRef.current = true;
      setScanResult("Checking ticket…");
      void fetch("/api/tickets/check-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: result.getText() }) })
        .then(async (response) => {
          const payload = await response.json() as { ticket?: { attendee_name?: string }; accessType?: "ticket" | "guestlist"; error?: string };
          if (!response.ok) throw new Error(payload.error || "Ticket could not be checked in");
          const name = payload.ticket?.attendee_name || "Guest";
          const label = payload.accessType === "guestlist" ? "Guestlist Pass" : "Ticket";
          setScanResult(`${label} verified — ${name}`);
          if (event) setRecentCheckIns((rows) => [{ id: crypto.randomUUID(), name, tier: label, checkedInAt: new Date().toISOString() }, ...rows]);
        })
        .catch((error: unknown) => setScanResult(error instanceof Error ? error.message : "Ticket could not be checked in"))
        .finally(() => window.setTimeout(() => { checkingRef.current = false; setScanResult(""); }, 2200));
    }).then((controls) => { if (disposed) controls.stop(); else scannerControlsRef.current = controls; });
    return () => { disposed = true; scannerControlsRef.current?.stop(); scannerControlsRef.current = null; };
  }, [cameraReady, event, previewCameraActive]);
  const checkIns = event ? recentCheckIns : attendees.map((person) => ({ id: person[0], name: person[0], tier: person[2], checkedInAt: person[4] }));
  return <div className="host-dashboard-screen checkin-dashboard-screen"><header className="dashboard-page-header checkin-page-header"><Link href={event ? "/dashboard?tab=check-in-team" : "/dashboard/events/mindset-mastery/attendees"} aria-label="Back"><DiscoverIcon name="chevron" /></Link><h1>Check-in</h1><button type="button" className="checkin-flash" aria-label={torchOn ? "Turn flash off" : "Turn flash on"} aria-pressed={torchOn} onClick={() => void toggleTorch()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2 5 13h6l-.5 9L19 10h-6l.5-8Z" /></svg></button></header><EventSummary compact event={event} /><div className={`dashboard-scanner${previewCameraActive ? " is-preview-camera" : ""}`}>{previewCameraActive ? <Image src="/events/checkin-qr-attendee.png" alt="Guest holding a QR ticket in front of the check-in camera" fill sizes="390px" priority /> : <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera for QR ticket scanning" />}<span className="scanner-frame"><i /><i /><i /><i /></span>{!cameraReady ? <div className="scanner-camera-error"><p>{cameraError}</p><button type="button" disabled={cameraPending} onClick={() => void startCamera()}>{cameraPending ? "Requesting Access…" : "Enable Camera"}</button></div> : <p role="status" className="scanner-live-status">{scanResult || "Align QR code within the frame"}</p>}</div><section className="dashboard-panel recent-checkins"><div className="dashboard-panel-title"><h2>Recent Check-ins</h2><button type="button" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>{showAll ? "Show Less" : "See All"} <DiscoverIcon name="arrow" /></button></div>{checkIns.length ? checkIns.slice(0, showAll ? checkIns.length : 4).map((person, index) => <div key={person.id}><Avatar name={person.name} portrait={index % 4} size={35} /><p><strong>{person.name}</strong><span>{person.tier}</span></p><time>{person.checkedInAt.includes("T") ? new Date(person.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : person.checkedInAt}</time><b>✓ Checked In</b></div>) : <p className="dashboard-empty">No guests checked in yet.</p>}</section></div>;
}

export function EarningsDashboard() {
  const summary = useHostEarnings("host");
  const event = summary?.byEvent.find((row) => row.slug === "mindset-mastery");
  return <div className="host-dashboard-screen manage-dashboard-screen"><header className="dashboard-page-header"><Link href="/dashboard/events/mindset-mastery" aria-label="Back"><DiscoverIcon name="chevron" /></Link><h1>Event Earnings</h1><span /></header><EventSummary /><ManageTabs active="Earnings" /><section className="dashboard-panel earnings-breakdown"><div className="dashboard-panel-title"><h2>Host Earnings</h2></div>{event?.currencies.map((row) => <div key={row.currency}><span><DashboardIcon name="coins" /></span><p><strong>{row.currency.toUpperCase()}</strong><small>{row.sales} paid orders</small></p><b>{earningsMoney(row.amountMinor, row.currency)}</b></div>)}{summary && !event?.currencies.length && <p className="dashboard-empty">No paid orders for this event yet.</p>}</section></div>;
}

export function EventSettingsDashboard() {
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const settings = [
    ["Change Date & Time", "Update when your event takes place", "/create?step=date", "calendar"],
    ["Change Location", "Update the event location", "/create?step=location", "pin"],
    ["Edit Event Details", "Update description, schedule, images, etc.", "/create?step=basic", "edit"],
    ["Manage Ticket Types", "Change prices, availability or add ticket types", "/create?step=tickets", "ticket"],
  ] as const;
  return <div className="host-dashboard-screen manage-dashboard-screen"><header className="dashboard-page-header"><Link href="/dashboard/events/mindset-mastery" aria-label="Back"><DiscoverIcon name="chevron" /></Link><h1>Event Settings</h1><span /></header><EventSummary compact /><ManageTabs active="Settings" /><section className="dashboard-event-settings">{settings.map(([title, text, href, icon]) => <Link href={href} key={title}><span>{icon === "edit" ? <DashboardIcon name="edit" /> : <DiscoverIcon name={icon} />}</span><p><strong>{title}</strong><small>{text}</small></p><DiscoverIcon name="chevron" /></Link>)}<button type="button" onClick={() => { setNotifyOpen((value) => !value); setNotice(""); }}><span><DiscoverIcon name="send" /></span><p><strong>Notify Attendees</strong><small>Send an update to all ticket holders</small></p><DiscoverIcon name="chevron" /></button>{notifyOpen && <form className="dashboard-attendee-message" onSubmit={(event) => { event.preventDefault(); if (!message.trim()) return; setNotice("Update sent to all attendees."); setMessage(""); }}><label>Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write your update…" /></label><button type="submit">Send Update</button>{notice && <p role="status">{notice}</p>}</form>}<button type="button" className="is-danger" onClick={() => setCancelOpen((value) => !value)}><span><DiscoverIcon name="x" /></span><p><strong>{cancelled ? "Event Cancelled" : "Cancel Event"}</strong><small>{cancelled ? "This event is no longer active" : "Cancel this event and handle refunds"}</small></p><DiscoverIcon name="chevron" /></button>{cancelOpen && !cancelled && <div className="dashboard-cancel-confirm"><p>This will notify all attendees and start the refund process.</p><button type="button" onClick={() => { setCancelled(true); setCancelOpen(false); }}>Confirm Cancellation</button><button type="button" onClick={() => setCancelOpen(false)}>Keep Event</button></div>}</section></div>;
}

type HostLiveMoment = { id: string; public_url: string; kind: "photo" | "video"; caption: string; status: "published" | "hidden"; created_at: string; profiles?: { first_name?: string | null; username?: string | null } | null; stats: { shares: number; reports: number; clicks: number; sales: number }; reports: Array<{ id: string; reason: string; status: string }> };

export function LiveMomentsDashboard() {
  const [moments, setMoments] = useState<HostLiveMoment[]>([]);
  const [event, setEvent] = useState<{ slug: string; title: string; live_discovery_enabled: boolean; live_notification_sent_at: string | null } | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/host/live-moments?event=mindset-mastery");
    const result = await response.json() as { event?: typeof event; moments?: HostLiveMoment[]; error?: string };
    if (response.ok) { setEvent(result.event || null); setMoments(result.moments || []); } else setNotice(result.error || "Could not load live moments");
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function moderate(momentId: string, status: "published" | "hidden") {
    const response = await fetch("/api/host/live-moments", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: event?.slug, momentId, status, reportStatus: status === "hidden" ? "reviewed" : "dismissed" }) });
    if (response.ok) setMoments((rows) => rows.map((row) => row.id === momentId ? { ...row, status, reports: row.reports.map((report) => ({ ...report, status: status === "hidden" ? "reviewed" : "dismissed" })) } : row));
  }
  async function remove(momentId: string) {
    const response = await fetch("/api/host/live-moments", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: event?.slug, momentId }) });
    if (response.ok) setMoments((rows) => rows.filter((row) => row.id !== momentId));
  }
  async function notifyLive() {
    const response = await fetch("/api/host/live-moments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: event?.slug }) });
    const result = await response.json() as { recipients?: number; alreadySent?: boolean; error?: string };
    setNotice(response.ok ? result.alreadySent ? "Live notification was already sent." : `Live notification sent to ${result.recipients || 0} people.` : result.error || "Notification could not be sent");
    if (response.ok && !result.alreadySent) setEvent((current) => current ? { ...current, live_notification_sent_at: new Date().toISOString() } : current);
  }
  return <div className="host-dashboard-screen manage-dashboard-screen"><header className="dashboard-page-header"><Link href="/dashboard/events/mindset-mastery" aria-label="Back"><DiscoverIcon name="chevron" /></Link><h1>Live Moments</h1><span /></header><EventSummary compact /><ManageTabs active="Live" /><section className="dashboard-live-tools"><div><span>LIVE EVENT</span><h2>{event?.title || "Your Event"}</h2><p>Moderate guest uploads and notify attendees when the event begins.</p></div><button type="button" disabled={!event?.live_discovery_enabled || Boolean(event?.live_notification_sent_at)} onClick={() => void notifyLive()}><DiscoverIcon name="bell" />{event?.live_notification_sent_at ? "Notification Sent" : "Notify: Event is Live"}</button></section>{notice && <p role="status" className="dashboard-live-notice">{notice}</p>}<section className="dashboard-live-moments">{loading ? <p className="dashboard-empty">Loading live moments…</p> : moments.length ? moments.map((moment) => <article key={moment.id} data-hidden={moment.status === "hidden"}>{moment.kind === "video" ? <video src={moment.public_url} controls playsInline /> : <Image src={moment.public_url} alt={moment.caption || "Live event moment"} width={108} height={130} unoptimized />}<div><span>{moment.status === "hidden" ? "HIDDEN" : "VISIBLE"}</span><h3>{moment.profiles?.first_name || moment.profiles?.username || "Guest"}</h3><p>{moment.caption || "Live from the event"}</p><ul><li>{moment.stats.clicks} clicks</li><li>{moment.stats.shares} shares</li><li>{moment.stats.sales} sales</li><li className={moment.stats.reports ? "has-reports" : ""}>{moment.stats.reports} reports</li></ul>{moment.reports.filter((report) => report.status === "open").map((report) => <small key={report.id}>Reported: {report.reason}</small>)}</div><footer><button type="button" onClick={() => void moderate(moment.id, moment.status === "hidden" ? "published" : "hidden")}>{moment.status === "hidden" ? "Restore" : "Hide"}</button><button type="button" onClick={() => void remove(moment.id)}>Delete</button></footer></article>) : <p className="dashboard-empty">No guest moments yet. Checked-in guests can upload while the event is live.</p>}</section></div>;
}

const eventAffiliates = [
  ["Lukas Weber", "@lukasw", "18 tickets", "€1,440", "€360", 0, "lukas-m"],
  ["Sophie Müller", "@sophiem", "12 tickets", "€960", "€240", 1, "sophie-k"],
  ["Marco Bianchi", "@marcob", "9 tickets", "€720", "€180", 2, "marco-b"],
  ["Emma Rossi", "@emmar", "6 tickets", "€480", "€120", 3, "emma-l"],
] as const;

export function EventAffiliatesDashboard() {
  type AffiliateRow = { affiliateId: string; name: string; handle: string; sales: number; grossMinor: number; amountMinor: number; currency: string };
  const [rows, setRows] = useState<AffiliateRow[] | null>(null);
  useEffect(() => { void fetch("/api/affiliates/event?event=mindset-mastery").then(async (response) => response.ok ? response.json() : null).then((result: { affiliates?: AffiliateRow[] } | null) => { if (result?.affiliates) setRows(result.affiliates); }); }, []);
  const affiliates = rows ?? eventAffiliates.map((person) => ({ affiliateId: person[6], name: person[0], handle: person[1], sales: Number(person[2].split(" ")[0]), grossMinor: Number(person[3].replace(/\D/g, "")) * 100, amountMinor: Number(person[4].replace(/\D/g, "")) * 100, currency: "eur" }));
  const sales = affiliates.reduce((sum, person) => sum + person.sales, 0); const gross = affiliates.reduce((sum, person) => sum + person.grossMinor, 0); const commission = affiliates.reduce((sum, person) => sum + person.amountMinor, 0); const currency = affiliates[0]?.currency || "eur";
  return <div className="host-dashboard-screen manage-dashboard-screen"><header className="dashboard-page-header"><Link href="/dashboard/events/mindset-mastery" aria-label="Back"><DiscoverIcon name="chevron" /></Link><h1>Event Affiliates</h1><span /></header><EventSummary /><ManageTabs active="Affiliates" /><section className="dashboard-metrics three"><MetricCard icon="users" value={String(sales)} label="Tickets Sold" /><MetricCard icon="coins" value={new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(gross / 100)} label="Affiliate Sales" /><MetricCard icon="wallet" value={new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(commission / 100)} label="Commission" /></section><section className="dashboard-panel dashboard-affiliate-list"><div className="dashboard-panel-title"><h2>Affiliates with Sales</h2><span>{affiliates.length} active</span></div>{affiliates.map((person, index) => <Link href={`/people/${person.affiliateId}`} key={person.affiliateId}><Avatar name={person.name} portrait={index % 4} size={38} /><p><strong>{person.name}</strong><small>{person.handle}</small></p><span>{person.sales} tickets<small>{new Intl.NumberFormat("en", { style: "currency", currency: person.currency.toUpperCase() }).format(person.grossMinor / 100)} sales</small></span><b>{new Intl.NumberFormat("en", { style: "currency", currency: person.currency.toUpperCase() }).format(person.amountMinor / 100)}<small>earned</small></b><DiscoverIcon name="chevron" /></Link>)}</section></div>;
}
