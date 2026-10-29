"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";
import type { EarningsSummary } from "@/types/earnings";

type Method = "Bank Transfer (SEPA)" | "PayPal" | "USDT (TRC20)" | "USDC (ERC20)";
type AffiliateSummary = {
  userId: string; totalMinor: number; availableMinor: number; pendingMinor: number; paidMinor: number; currency: string;
  promotedEvents: Array<{ id: string; slug: string; title: string; coverUrl: string | null; clicks: number; uniqueVisitors: number; acceptedInvites: number; sales: number; earnedMinor: number; currency: string }>;
  lifetimeReferrals: Array<{ userId: string; name: string; username: string; joinedAt: string; sales: number; earnedMinor: number; currency: string }>;
  stats: { clicks: number; uniqueVisitors: number; acceptedInvites: number; sales: number };
  commissions: Array<{ id: string; amount_minor: number; currency: string; created_at: string; events: { title: string } | null }>;
  payouts: Array<{ amount_minor: number; currency: string; status: string; created_at: string }>;
};
type PayoutSource = "affiliate" | "host" | "cohost" | "team";
const money = (minor: number, currency = "eur") => new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);

function useAffiliateSummary() {
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  useEffect(() => { void fetch("/api/affiliates/summary").then(async (response) => response.ok ? response.json() : null).then((data) => { if (data) setSummary(data as AffiliateSummary); }); }, []);
  return summary;
}


function BackHeader({ title, backHref = "/affiliate" }: { title: string; backHref?: string }) {
  return <header className="affiliate-header"><Link href={backHref} aria-label="Back"><DiscoverIcon name="chevron" /></Link><h1>{title}</h1><span /></header>;
}

function MethodBadge({ method }: { method: Method }) {
  const label = method.startsWith("Bank") ? "▥" : method === "PayPal" ? "P" : method.startsWith("USDT") ? "₮" : "$";
  return <span className="affiliate-method-badge" data-method={method}>{label}</span>;
}

function useStripePayoutSetup(source: PayoutSource) {
  const [state, setState] = useState<"checking" | "opening" | "ready" | "required" | "error">("checking");
  const [error, setError] = useState("");
  const started = useRef(false);
  const openSetup = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    setState("opening");
    setError("");
    try {
      const response = await fetch("/api/payouts/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source }) });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Stripe setup could not be opened");
      window.location.assign(result.url);
    } catch (setupError) {
      started.current = false;
      setError(setupError instanceof Error ? setupError.message : "Stripe setup could not be opened");
      setState("error");
    }
  }, [source]);
  useEffect(() => {
    let active = true;
    void fetch("/api/payouts/connect", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { ready?: boolean; setupRequired?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Payout setup could not be checked");
      if (!active) return;
      if (result.ready) return setState("ready");
      const returnedFromStripe = new URLSearchParams(window.location.search).has("connected");
      if (result.setupRequired && !returnedFromStripe) void openSetup();
      else setState("required");
    }).catch((setupError) => {
      if (!active) return;
      setError(setupError instanceof Error ? setupError.message : "Payout setup could not be checked");
      setState("error");
    });
    return () => { active = false; };
  }, [openSetup]);
  return { state, error, openSetup };
}

function StripePayoutGate({ state, error, onContinue }: { state: "checking" | "opening" | "required" | "error"; error: string; onContinue: () => void }) {
  return <section className="affiliate-stripe-gate"><span>▥</span><h2>{state === "required" ? "Finish your payout setup" : state === "error" ? "Stripe could not be opened" : "Opening Stripe…"}</h2><p>{state === "required" ? "Complete your secure Stripe verification before withdrawing funds." : state === "error" ? error : "You’ll return to Attnd automatically when your payout account is ready."}</p>{(state === "required" || state === "error") && <button type="button" className="affiliate-primary" onClick={onContinue}>Continue with Stripe</button>}</section>;
}

export function AffiliateWalletScreen() {
  const summary = useAffiliateSummary();
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"Overview" | "Statistics">("Overview");
  const appLink = summary?.userId ? `https://www.attnd.space/onboarding?affiliate_id=${summary.userId}` : "";
  async function copyAppLink() {
    if (!appLink) return;
    await navigator.clipboard.writeText(appLink);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 2500);
  }
  return <div className="affiliate-screen">
    <header className="affiliate-wallet-title"><div><h1>Affiliate Dashboard</h1></div></header>
    <div className="affiliate-main-tabs" role="tablist" aria-label="Affiliate dashboard views">{(["Overview", "Statistics"] as const).map((tab) => <button type="button" role="tab" key={tab} aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>
    {activeTab === "Overview" ? <>
      <section className="affiliate-total"><p>Total Earnings</p><strong>{summary ? money(summary.totalMinor, summary.currency) : "—"}</strong><small>All time earnings from your referrals</small></section>
      <section className="affiliate-balance-grid"><article><span>◷</span><strong>{summary ? money(summary.pendingMinor, summary.currency) : "—"}</strong><small>Pending</small></article><article><span>▭</span><strong>{summary ? money(summary.availableMinor, summary.currency) : "—"}</strong><small>Available</small></article><article><span>✓</span><strong>{summary ? money(summary.paidMinor, summary.currency) : "—"}</strong><small>Paid Out</small></article></section>
      <section className="affiliate-app-link"><div><strong>Invite people to Attnd</strong><small>Your personal affiliate link</small></div><code>{appLink || "Loading your link…"}</code><button type="button" disabled={!appLink} onClick={() => void copyAppLink()}>{linkCopied ? "Copied ✓" : "Copy Link"}</button></section>
      <Link href="/affiliate/withdraw" className="affiliate-primary">Withdraw Funds</Link>
      <section className="affiliate-promoted"><header><h2>Events You Promote</h2></header>{summary?.promotedEvents.length ? summary.promotedEvents.map((event) => <Link href={`/events/${event.slug}`} key={event.id}><strong>{event.title}</strong><span>{event.clicks} clicks · {event.acceptedInvites} joined · {event.sales} sales</span><b>{money(event.earnedMinor, event.currency)}</b></Link>) : <p>No promoted events yet. Share an event to start tracking it.</p>}</section>
      <section className="affiliate-referrals"><header><h2>People You Invited</h2></header>{summary?.lifetimeReferrals.length ? summary.lifetimeReferrals.map((person) => <Link href={`/people/${person.userId}`} key={person.userId}><strong>{person.name}</strong><span>{person.sales} sales</span><b>{money(person.earnedMinor, person.currency)}</b></Link>) : <p>People who join Attnd through your link will appear here.</p>}</section>
      <section className="affiliate-recent"><header><h2>Recent Earnings</h2><Link href="/affiliate/earnings">See All <DiscoverIcon name="arrow" /></Link></header>{summary?.commissions.slice(0, 3).map((row) => <article key={row.id}><span className="affiliate-earning-symbol">↗</span><p><strong>{row.events?.title || "Event sale"}</strong><small>{new Date(row.created_at).toLocaleDateString()}</small></p><div><b>{money(row.amount_minor, row.currency)}</b><small>Commission</small></div></article>)}{!summary?.commissions.length && <p className="affiliate-empty-row">No earnings yet.</p>}</section>
      <section className="affiliate-payout-preview"><header><h2>Payout History</h2><Link href="/affiliate/history">See All <DiscoverIcon name="arrow" /></Link></header>{summary?.payouts.slice(0, 3).map((row) => <article key={`${row.created_at}-${row.amount_minor}`}><span className="affiliate-earning-symbol">↗</span><p><strong>{money(row.amount_minor, row.currency)}</strong><small>{new Date(row.created_at).toLocaleDateString()}</small></p><b data-status={row.status}>{row.status}</b></article>)}{!summary?.payouts.length && <p className="affiliate-empty-row">No payouts yet.</p>}</section>
    </> : <>
      <section className="affiliate-stat-grid"><article><strong>{summary?.stats.clicks ?? 0}</strong><span>Link clicks</span></article><article><strong>{summary?.stats.uniqueVisitors ?? 0}</strong><span>Unique visitors</span></article><article><strong>{summary?.stats.acceptedInvites ?? 0}</strong><span>Invites accepted</span></article><article><strong>{summary?.stats.sales ?? 0}</strong><span>Ticket sales</span></article></section>
      <section className="affiliate-promoted"><header><h2>Clicks by Event</h2></header>{summary?.promotedEvents.length ? summary.promotedEvents.map((event) => <Link href={`/events/${event.slug}`} key={event.id}><strong>{event.title}</strong><span>{event.uniqueVisitors} unique visitors · {event.acceptedInvites} joined</span><b>{event.clicks} clicks</b></Link>) : <p>No event link clicks yet.</p>}</section>
      <section className="affiliate-referrals"><header><h2>Lifetime Referrals</h2></header><p>{summary?.lifetimeReferrals.length ?? 0} people joined Attnd through your link.</p></section>
    </>}
  </div>;
}

export function AffiliateWithdrawScreen() {
  const summary = useAffiliateSummary();
  const payoutSetup = useStripePayoutSetup("affiliate");
  const [amount, setAmount] = useState("500.00");
  const [method, setMethod] = useState<Method>("Bank Transfer (SEPA)");
  const numberAmount = Math.max(0, Number(amount) || 0);
  const available = summary ? summary.availableMinor / 100 : 0;
  if (payoutSetup.state !== "ready") return <div className="affiliate-screen affiliate-withdraw-screen"><BackHeader title="Withdraw Funds" /><StripePayoutGate state={payoutSetup.state} error={payoutSetup.error} onContinue={() => void payoutSetup.openSetup()} /></div>;
  return <div className="affiliate-screen affiliate-withdraw-screen"><BackHeader title="Withdraw Funds" /><section className="affiliate-available"><small>Available Balance</small><strong>{summary ? money(summary.availableMinor, summary.currency) : "—"}</strong><p>Enter the amount you’d like to withdraw.</p></section><label className="affiliate-amount"><span>{summary?.currency?.toUpperCase() || "EUR"}</span><input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} /><button type="button" onClick={() => setAmount(available.toFixed(2))}>MAX</button></label><p className="affiliate-minimum">Min. withdrawal: 50.00</p><section className="affiliate-withdraw-summary"><p>Amount <b>{numberAmount.toFixed(2)}</b></p><p>Processing Fee (1%) <b>- {(numberAmount * .01).toFixed(2)}</b></p><p>You will receive <strong>{(numberAmount * .99).toFixed(2)}</strong></p></section><h2 className="affiliate-subheading">Select Payout Method</h2><section className="affiliate-methods">{(["Bank Transfer (SEPA)", "PayPal", "USDT (TRC20)", "USDC (ERC20)"] as Method[]).map((item) => <button key={item} type="button" aria-pressed={method === item} onClick={() => setMethod(item)}><MethodBadge method={item} /><p><strong>{item}</strong><small>Payout details are secured with Stripe Connect</small></p>{item.startsWith("Bank") && <em>Recommended</em>}<i /></button>)}</section><div className="affiliate-withdraw-action"><Link href={`/affiliate/withdraw/review?amount=${numberAmount.toFixed(2)}&currency=${summary?.currency || "eur"}&method=${encodeURIComponent(method)}`} className="affiliate-primary affiliate-withdraw-continue">Continue</Link></div></div>;
}

export function AffiliateReviewScreen({ amountValue = "0", currencyValue = "eur", methodValue = "Bank Transfer (SEPA)" }: { amountValue?: string; currencyValue?: string; methodValue?: string }) {
  const [done, setDone] = useState(false);
  const amount = Math.max(0, Number(amountValue) || 0); const currency = currencyValue; const method = methodValue as Method;
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const confirm = async () => { setBusy(true); setNotice(""); const response = await fetch("/api/payouts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: "affiliate", amountMinor: Math.round(amount * 100), currency }) }); const result = await response.json() as { error?: string; setupRequired?: boolean }; if (result.setupRequired) { const setup = await fetch("/api/payouts/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: "affiliate" }) }); const link = await setup.json() as { url?: string; error?: string }; if (link.url) { window.location.assign(link.url); return; } setNotice(link.error || "Payout setup failed"); } else if (!response.ok) setNotice(result.error || "Payout failed"); else setDone(true); setBusy(false); };
  return <div className="affiliate-screen affiliate-review-screen"><BackHeader title="Review & Confirm" />{done ? <section className="affiliate-confirmed"><span>✓</span><h2>Withdrawal sent</h2><p>Your payout was submitted through Stripe Connect.</p><Link href="/affiliate/history">View Payout History</Link></section> : <><section className="affiliate-bank-card"><header><MethodBadge method={method} /><strong>{method}</strong><Link href="/affiliate/withdraw">Change</Link></header><p><span>Payout account</span>Stripe Connect</p></section><section className="affiliate-review-summary"><h2>Withdrawal Summary</h2><p>Amount <b>{money(Math.round(amount * 100), currency)}</b></p><p>Processing Fee (1%) <b>- {money(Math.round(amount * 100 * .01), currency)}</b></p><p>You will receive <strong>{money(Math.round(amount * 100 * .99), currency)}</strong></p></section><p className="affiliate-info"><DiscoverIcon name="info" />Your identity and payout details are verified securely by Stripe Connect.</p>{notice && <p role="alert" className="payment-notice">{notice}</p>}<button type="button" disabled={busy} className="affiliate-primary affiliate-confirm" onClick={() => void confirm()}>{busy ? "Processing…" : "Confirm Withdrawal"}</button></>}</div>;
}

export function AffiliateHistoryScreen() {
  const [filter, setFilter] = useState("All");
  const [rows, setRows] = useState<readonly (readonly [string, Method, string, string])[]>([]);
  useEffect(() => { void fetch("/api/payouts?source=affiliate").then(async (response) => response.ok ? response.json() : null).then((result: { payouts?: Array<{ id: string; amount_minor: number; currency: string; status: string; created_at: string }> } | null) => { if (result?.payouts) setRows(result.payouts.map((row) => [money(row.amount_minor, row.currency), "Bank Transfer (SEPA)", new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(row.created_at)), row.status[0].toUpperCase() + row.status.slice(1)] as const)); }); }, []);
  const visible = rows.filter((row) => filter === "All" || row[3] === filter);
  return <div className="affiliate-screen"><BackHeader title="Payout History" /><div className="affiliate-history-filters">{["All", "Pending", "Paid", "Failed"].map((item) => <button type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}{item !== "All" && ` (${rows.filter((row) => row[3] === item).length})`}</button>)}</div><section className="affiliate-history-list">{visible.map((row) => <article key={`${row[0]}-${row[2]}`}><MethodBadge method={row[1]} /><p><strong>{row[0]}</strong><span>{row[1]}</span><small>{row[2]}</small></p><b data-status={row[3]}>{row[3]}</b><DiscoverIcon name="chevron" /></article>)}</section></div>;
}

export function AffiliateEarningsScreen() {
  const summary = useAffiliateSummary();
  return <div className="affiliate-screen"><BackHeader title="All Earnings" /><section className="affiliate-list-summary"><small>Total affiliate earnings</small><strong>{summary ? money(summary.totalMinor, summary.currency) : "—"}</strong><span>{summary?.commissions.length ?? 0} ticket sales</span></section><section className="affiliate-all-earnings">{summary?.commissions.map((row) => <article key={row.id}><span className="affiliate-earning-symbol">↗</span><p><strong>{row.events?.title || "Event sale"}</strong><small>Affiliate commission</small><time>{new Date(row.created_at).toLocaleDateString()}</time></p><b>{money(row.amount_minor, row.currency)}</b></article>)}{!summary?.commissions.length && <p className="affiliate-empty-row">No earnings yet.</p>}</section></div>;
}

export function AffiliateEventEarningsScreen() {
  const summary = useAffiliateSummary();
  const earningEvents = summary?.promotedEvents.filter((event) => event.sales > 0) || [];
  return <div className="affiliate-screen"><BackHeader title="Earnings by Event" /><section className="affiliate-list-summary"><small>Total across all events</small><strong>{summary ? money(summary.totalMinor, summary.currency) : "—"}</strong><span>{earningEvents.length} earning events</span></section><section className="affiliate-event-earnings-list">{earningEvents.map((event) => <article key={event.id}><Image src={event.coverUrl || "/events/palm-gathering.jpg"} alt="" width={82} height={64} unoptimized={Boolean(event.coverUrl?.startsWith("http") && !event.coverUrl.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`))} /><p><strong>{event.title}</strong><small>{event.sales} sales</small></p><div><b>{money(event.earnedMinor, event.currency)}</b><small>{event.clicks} clicks</small></div></article>)}{!earningEvents.length && <p className="affiliate-empty-row">No event earnings yet.</p>}</section></div>;
}

type DashboardPayoutSource = "host" | "cohost" | "team";

function sourceTab(source: DashboardPayoutSource) {
  return source === "cohost" ? "Co-Hosting" : source === "team" ? "Team" : "Earnings";
}

function usePayoutEarnings(source: DashboardPayoutSource) {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  useEffect(() => { void fetch(`/api/earnings?source=${source}`).then(async (response) => response.ok ? response.json() : null).then((data: EarningsSummary | null) => setSummary(data)).catch(() => setSummary(null)); }, [source]);
  return summary;
}

export function HostWithdrawScreen({ source = "host", initialCurrency = "thb" }: { source?: DashboardPayoutSource; initialCurrency?: string }) {
  const summary = usePayoutEarnings(source);
  const payoutSetup = useStripePayoutSetup(source);
  const [currency, setCurrency] = useState(initialCurrency);
  const [amount, setAmount] = useState("");
  const balance = summary?.balances.find((item) => item.currency === currency) || summary?.balances[0];
  const selectedCurrency = balance?.currency || currency;
  const available = balance?.availableMinor || 0;
  const amountMinor = Math.round(Math.max(0, Number(amount) || 0) * 100);
  const canContinue = amountMinor >= 5000 && amountMinor <= available;
  if (payoutSetup.state !== "ready") return <div className="affiliate-screen affiliate-withdraw-screen"><BackHeader title={source === "cohost" ? "Co-Host Withdrawal" : source === "team" ? "Team Earnings Withdrawal" : "Withdraw Funds"} backHref={`/dashboard?tab=${sourceTab(source)}`} /><StripePayoutGate state={payoutSetup.state} error={payoutSetup.error} onContinue={() => void payoutSetup.openSetup()} /></div>;
  return <div className="affiliate-screen affiliate-withdraw-screen"><BackHeader title={source === "cohost" ? "Co-Host Withdrawal" : source === "team" ? "Team Earnings Withdrawal" : "Withdraw Funds"} backHref={`/dashboard?tab=${sourceTab(source)}`} /><section className="affiliate-available"><small>Available Balance</small><strong>{balance ? money(available, selectedCurrency) : "—"}</strong><p>Funds become available seven days after the event and payment.</p></section>{summary && summary.balances.length > 1 && <label className="dashboard-earnings-currency">Currency <select value={selectedCurrency} onChange={(event) => { setCurrency(event.target.value); setAmount(""); }}>{summary.balances.map((item) => <option key={item.currency} value={item.currency}>{item.currency.toUpperCase()}</option>)}</select></label>}<label className="affiliate-amount"><span>{selectedCurrency.toUpperCase()}</span><input value={amount} inputMode="decimal" aria-label="Withdrawal amount" onChange={(event) => setAmount(event.target.value)} /><button type="button" onClick={() => setAmount((available / 100).toFixed(2))}>MAX</button></label><p className="affiliate-minimum">Minimum withdrawal: {money(5000, selectedCurrency)}</p><section className="affiliate-withdraw-summary"><p>Amount <b>{money(amountMinor, selectedCurrency)}</b></p><p>Processing Fee (1%) <b>- {money(Math.round(amountMinor * .01), selectedCurrency)}</b></p><p>Sent to your Stripe account <strong>{money(amountMinor - Math.round(amountMinor * .01), selectedCurrency)}</strong></p></section><section className="affiliate-bank-card"><header><strong>Stripe Connect</strong></header><p>Your bank account is managed securely by Stripe.</p></section><div className="affiliate-withdraw-action"><Link aria-disabled={!canContinue} href={canContinue ? `/dashboard/withdraw/review?amount=${(amountMinor / 100).toFixed(2)}&currency=${selectedCurrency}&source=${source}` : "#"} className="affiliate-primary affiliate-withdraw-continue">Continue</Link></div></div>;
}

export function HostWithdrawReviewScreen({ amountValue = "0", currency = "thb", source = "host" }: { amountValue?: string; currency?: string; source?: DashboardPayoutSource }) {
  const [done, setDone] = useState(false);
  const amountMinor = Math.round(Math.max(0, Number(amountValue) || 0) * 100);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const backHref = `/dashboard/withdraw?source=${source}&currency=${currency}`;
  const confirm = async () => { setBusy(true); setNotice(""); try { const response = await fetch("/api/payouts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source, amountMinor, currency }) }); const result = await response.json() as { error?: string; setupRequired?: boolean }; if (result.setupRequired) { const setup = await fetch("/api/payouts/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source }) }); const link = await setup.json() as { url?: string; error?: string }; if (link.url) { window.location.assign(link.url); return; } setNotice(link.error || "Payout setup failed"); } else if (!response.ok) setNotice(result.error || "Payout failed"); else setDone(true); } catch { setNotice("Payout could not be submitted. Please try again."); } finally { setBusy(false); } };
  return <div className="affiliate-screen affiliate-review-screen"><BackHeader title="Review & Confirm" backHref={backHref} />{done ? <section className="affiliate-confirmed"><span>✓</span><h2>Transfer submitted</h2><p>Your earnings were sent to your Stripe Connect account. Stripe handles the bank payout.</p><Link href={`/dashboard/payouts?source=${source}`}>View Payout History</Link></section> : <><section className="affiliate-bank-card"><header><strong>Stripe Connect</strong><Link href={backHref}>Change</Link></header><p>Payout destination in Stripe</p></section><section className="affiliate-review-summary"><h2>Withdrawal Summary</h2><p>Amount <b>{money(amountMinor, currency)}</b></p><p>Processing Fee (1%) <b>- {money(Math.round(amountMinor * .01), currency)}</b></p><p>Sent to Stripe <strong>{money(amountMinor - Math.round(amountMinor * .01), currency)}</strong></p></section><p className="affiliate-info"><DiscoverIcon name="info" />Stripe confirms your payout account before funds are sent.</p>{notice && <p role="alert" className="payment-notice">{notice}</p>}<button type="button" disabled={busy || amountMinor < 5000} className="affiliate-primary affiliate-confirm" onClick={() => void confirm()}>{busy ? "Processing…" : "Confirm Withdrawal"}</button></>}</div>;
}

export function HostPayoutHistoryScreen({ source = "host" }: { source?: DashboardPayoutSource }) {
  const [filter, setFilter] = useState("All");
  const summary = usePayoutEarnings(source);
  const rows = summary?.payouts || [];
  const visible = rows.filter((row) => filter === "All" || row.status === filter.toLowerCase());
  return <div className="affiliate-screen"><BackHeader title="Payout History" backHref={`/dashboard?tab=${sourceTab(source)}`} /><div className="affiliate-history-filters">{["All", "Processing", "Paid", "Failed"].map((item) => <button type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}{item !== "All" && ` (${rows.filter((row) => row.status === item.toLowerCase()).length})`}</button>)}</div><section className="affiliate-history-list">{visible.map((row) => <article key={row.id}><span className="affiliate-method-badge">▥</span><p><strong>{money(row.amount_minor, row.currency)}</strong><span>Stripe Connect</span><small>{new Date(row.created_at).toLocaleDateString()}</small></p><b data-status={row.status}>{row.status === "paid" ? "Transferred" : row.status}</b></article>)}{summary && !rows.length && <p className="affiliate-empty-row">No payouts yet.</p>}</section></div>;
}
