import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

type Props = { params: Promise<{ id: string }> };
const money = (minor: number, currency = "thb") => new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
const date = (value?: string | null) => value ? new Date(value).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }) : "—";
const person = (value: unknown) => { const item = value as { first_name?: string | null; username?: string | null } | null; return item?.first_name || (item?.username ? `@${item.username}` : "Member"); };

export default async function AdminPayoutDetailPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) notFound();
  const { admin, role, user } = await requireAdmin();
  const { data: payout } = await admin.from("payout_requests").select("id,user_id,source,amount_minor,fee_minor,currency,method,provider_transfer_id,status,failure_reason,created_at,paid_at,profiles!payout_requests_user_id_fkey(id,first_name,username,city,stripe_connect_account_id)").eq("id", id).maybeSingle();
  if (!payout) notFound();
  const recipient = payout.profiles as unknown as { id: string; first_name?: string | null; username?: string | null; city?: string | null; stripe_connect_account_id?: string | null } | null;
  const [authResult, historyResult, adminProfileResult, earningsResult] = await Promise.all([
    admin.auth.admin.getUserById(payout.user_id),
    admin.from("payout_requests").select("id,source,amount_minor,fee_minor,currency,status,created_at,paid_at,failure_reason").eq("user_id", payout.user_id).order("created_at", { ascending: false }).limit(100),
    admin.from("profiles").select("first_name,username,avatar_url").eq("id", user.id).maybeSingle(),
    payout.source === "affiliate"
      ? admin.from("affiliate_commissions").select("id,order_id,amount_minor,currency,status,created_at,available_at,events(title,slug)").eq("affiliate_user_id", payout.user_id).eq("currency", payout.currency).order("created_at", { ascending: false }).limit(100)
      : admin.from("revenue_allocations").select("order_id,event_id,role,amount_minor,currency,status,created_at,available_at,events(title,slug)").eq("user_id", payout.user_id).eq("role", payout.source).eq("currency", payout.currency).order("created_at", { ascending: false }).limit(100),
  ]);
  const adminName = adminProfileResult.data?.first_name || adminProfileResult.data?.username || user.email?.split("@")[0] || "Admin";
  const history = historyResult.data || [];
  const paidTotal = history.filter((item) => item.status === "paid").reduce((sum,item) => sum + item.amount_minor,0);
  const earnings = earningsResult.data || [];
  return <main className="admin-shell"><AdminSidebar active="Payouts" role={role} name={adminName} avatarUrl={adminProfileResult.data?.avatar_url} /><section className="admin-detail-page">
    <header className="admin-detail-top"><Link href="/admin?tab=Payouts">← All payouts</Link><span>PAYOUT RECORD</span></header>
    <section className="admin-detail-hero"><div><p>SUPERADMIN · PAYOUT DETAIL</p><h1>Payout {payout.id.slice(0,8)}</h1><span>{person(recipient)} · Requested {date(payout.created_at)}</span></div><div><span className="admin-status" data-status={payout.status}>{payout.status}</span></div></section>
    {payout.failure_reason && <p className="admin-detail-warning"><strong>Failure reason:</strong> {payout.failure_reason}</p>}
    <section className="admin-detail-kpis"><Metric label="Gross request" value={money(payout.amount_minor,payout.currency)} /><Metric label="Fee" value={money(payout.fee_minor,payout.currency)} /><Metric label="Net transfer" value={money(payout.amount_minor-payout.fee_minor,payout.currency)} /><Metric label="Source" value={payout.source} /><Metric label="Previous payouts" value={history.length} /><Metric label="Lifetime paid" value={money(paidTotal,payout.currency)} /></section>
    <section className="admin-detail-grid"><DetailCard title="Transfer"><Info label="Status" value={payout.status} /><Info label="Method" value={payout.method.replaceAll("_", " ")} /><Info label="Currency" value={payout.currency.toUpperCase()} /><Info label="Provider transfer ID" value={payout.provider_transfer_id || "—"} /><Info label="Requested" value={date(payout.created_at)} /><Info label="Paid" value={date(payout.paid_at)} /></DetailCard><DetailCard title="Recipient"><Info label="Name" value={person(recipient)} /><Info label="Email" value={authResult.data.user?.email || "—"} /><Info label="City" value={recipient?.city || "—"} /><Info label="Stripe Connect" value={recipient?.stripe_connect_account_id || "Not connected"} /><Info label="User ID" value={payout.user_id} /><div className="admin-detail-links"><Link href={`/admin/users/${payout.user_id}`}>Open user record</Link></div></DetailCard></section>
    <AdminSection title="Related earnings context"><Table headers={["Record","Event","Amount","Status","Available"]}>{earnings.map((item) => { const event = item.events as unknown as { title?: string } | null; const recordId = "id" in item ? item.id : item.order_id; return <tr key={String(recordId)}><td><code>{String(recordId).slice(0,8)}</code></td><td>{event?.title || "Event"}</td><td>{money(item.amount_minor,item.currency)}</td><td>{item.status}</td><td>{date(item.available_at)}</td></tr>; })}</Table><p className="admin-detail-context-note">These are the recipient’s recent earnings for the same source and currency. Payout requests reserve balances in aggregate and are not tied to individual earning rows.</p></AdminSection>
    <AdminSection title="Payout history"><Table headers={["Payout","Source","Gross","Fee","Status","Requested","Paid"]}>{history.map((item) => <tr key={item.id}><td>{item.id === payout.id ? <strong>Current · {item.id.slice(0,8)}</strong> : <Link href={`/admin/payouts/${item.id}`}><code>{item.id.slice(0,8)}</code></Link>}</td><td>{item.source}</td><td>{money(item.amount_minor,item.currency)}</td><td>{money(item.fee_minor,item.currency)}</td><td>{item.status}</td><td>{date(item.created_at)}</td><td>{date(item.paid_at)}</td></tr>)}</Table></AdminSection>
  </section></main>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <article><span>{label}</span><strong>{value}</strong></article>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="admin-detail-info"><span>{label}</span><strong>{value}</strong></div>; }
function DetailCard({ title, children }: { title: string; children: ReactNode }) { return <article className="admin-detail-card"><h2>{title}</h2>{children}</article>; }
function AdminSection({ title, children }: { title: string; children: ReactNode }) { return <section className="admin-detail-section"><h2>{title}</h2>{children}</section>; }
function Table({ headers, children }: { headers: string[]; children: ReactNode }) { return <div className="admin-table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
