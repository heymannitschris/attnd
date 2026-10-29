import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminModerationButtons } from "@/components/admin/AdminModerationButtons";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

type Props = { params: Promise<{ id: string }> };
const money = (minor: number, currency = "thb") => new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
const date = (value?: string | null) => value ? new Date(value).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) notFound();
  const { admin, role, user } = await requireAdmin();
  const [profileResult, authResult, eventsResult, ordersResult, ticketsResult, commissionsResult, visitsCount, payoutsResult, membershipResult, teamResult, staffResult, adminRoleResult, refundsResult, adminProfileResult] = await Promise.all([
    admin.from("profiles").select("id,username,first_name,avatar_url,city,language,interests,bio,onboarding_complete,account_status,suspension_reason,suspended_at,created_at,updated_at,stripe_connect_account_id").eq("id", id).maybeSingle(),
    admin.auth.admin.getUserById(id),
    admin.from("events").select("id,slug,title,status,admin_suspended,starts_at,created_at").eq("host_id", id).order("created_at", { ascending: false }),
    admin.from("orders").select("id,payment_status,total_minor,platform_fee_minor,currency,created_at,events(title,slug)").eq("buyer_id", id).order("created_at", { ascending: false }).limit(100),
    admin.from("tickets").select("id,status,created_at,events(title,slug)").eq("owner_id", id).order("created_at", { ascending: false }).limit(100),
    admin.from("affiliate_commissions").select("id,status,amount_minor,currency,rate,created_at,events(title,slug)").eq("affiliate_user_id", id).order("created_at", { ascending: false }).limit(100),
    admin.from("affiliate_link_visits").select("id", { count: "exact", head: true }).eq("affiliate_user_id", id),
    admin.from("payout_requests").select("id,source,status,amount_minor,fee_minor,currency,created_at,failure_reason").eq("user_id", id).order("created_at", { ascending: false }),
    admin.from("local_memberships").select("id,locality,status,verified_at,expires_at,submitted_at,review_note").eq("user_id", id).maybeSingle(),
    admin.from("event_team_members").select("id,role_title,status,compensation_type,fixed_amount_minor,compensation_percent,currency,events(title,slug)").eq("user_id", id),
    admin.from("event_staff").select("event_id,role,status,events(title,slug)").eq("user_id", id).eq("role", "check_in"),
    admin.from("admin_users").select("role,active,created_at").eq("user_id", id).maybeSingle(),
    admin.from("refund_requests").select("id,status,reason,created_at,orders(total_minor,currency,events(title,slug))").eq("requester_id", id).order("created_at", { ascending: false }),
    admin.from("profiles").select("first_name,username,avatar_url").eq("id", user.id).maybeSingle(),
  ]);
  const profile = profileResult.data;
  if (!profile) notFound();
  const authUser = authResult.data.user;
  const orders = ordersResult.data || [];
  const paidOrders = orders.filter((order) => order.payment_status === "paid" || order.payment_status === "refunded");
  const commissions = commissionsResult.data || [];
  const commissionTotal = commissions.filter((item) => item.status !== "reversed").reduce((sum, item) => sum + item.amount_minor, 0);
  const adminName = adminProfileResult.data?.first_name || adminProfileResult.data?.username || user.email?.split("@")[0] || "Admin";
  return <main className="admin-shell"><AdminSidebar active="Users" role={role} name={adminName} avatarUrl={adminProfileResult.data?.avatar_url} /><section className="admin-detail-page">
    <header className="admin-detail-top"><Link href="/admin">← Admin dashboard</Link><span>USER RECORD</span></header>
    <section className="admin-detail-hero"><div><p>SUPERADMIN · USER DETAIL</p><h1>{profile.first_name || profile.username || "Attnd member"}</h1><span>@{profile.username || "member"} · Joined {date(profile.created_at)}</span></div><div><span className="admin-status" data-status={profile.account_status}>{profile.account_status}</span><AdminModerationButtons targetId={id} targetType="user" suspended={profile.account_status === "suspended"} role={role} /></div></section>
    {profile.suspension_reason && <p className="admin-detail-warning"><strong>Suspension reason:</strong> {profile.suspension_reason}</p>}
    <section className="admin-detail-kpis"><Metric label="Hosted events" value={eventsResult.data?.length || 0} /><Metric label="Tickets owned" value={ticketsResult.data?.length || 0} /><Metric label="Orders" value={orders.length} /><Metric label="Customer value" value={money(paidOrders.reduce((sum, item) => sum + item.total_minor, 0), paidOrders[0]?.currency)} /><Metric label="Affiliate clicks" value={visitsCount.count || 0} /><Metric label="Affiliate commission" value={money(commissionTotal, commissions[0]?.currency)} /></section>
    <section className="admin-detail-grid"><DetailCard title="Account"><Info label="Email" value={authUser?.email || "—"} /><Info label="Phone" value={authUser?.phone || "—"} /><Info label="City" value={profile.city || "—"} /><Info label="Language" value={profile.language} /><Info label="Onboarding" value={profile.onboarding_complete ? "Complete" : "Incomplete"} /><Info label="Last sign in" value={date(authUser?.last_sign_in_at)} /><Info label="Stripe Connect" value={profile.stripe_connect_account_id ? "Connected" : "Not connected"} /><Info label="Admin role" value={adminRoleResult.data?.active ? adminRoleResult.data.role : "No admin access"} /></DetailCard><DetailCard title="Membership & roles"><Info label="Local Membership" value={membershipResult.data ? `${membershipResult.data.status} · ${membershipResult.data.locality}` : "None"} /><Info label="Local submitted" value={date(membershipResult.data?.submitted_at)} /><Info label="Event team roles" value={String(teamResult.data?.length || 0)} /><Info label="Check-in roles" value={String(staffResult.data?.length || 0)} /><Info label="Interests" value={(profile.interests || []).join(", ") || "—"} /></DetailCard></section>
    <AdminSection title="Hosted events"><Table headers={["Event","Date","Status","Moderation"]}>{(eventsResult.data || []).map((event) => <tr key={event.id}><td><Link href={`/admin/events/${event.id}`}>{event.title}</Link></td><td>{date(event.starts_at)}</td><td>{event.status}</td><td>{event.admin_suspended ? "Suspended" : "Clear"}</td></tr>)}</Table></AdminSection>
    <AdminSection title="Orders"><Table headers={["Order","Event","Amount","Platform fee","Status","Created"]}>{orders.map((order) => <tr key={order.id}><td><Link href={`/admin/orders/${order.id}`}><code>{order.id.slice(0,8)}</code></Link></td><td>{(order.events as unknown as { title?: string } | null)?.title || "Event"}</td><td>{money(order.total_minor, order.currency)}</td><td>{money(order.platform_fee_minor, order.currency)}</td><td>{order.payment_status}</td><td>{date(order.created_at)}</td></tr>)}</Table></AdminSection>
    <AdminSection title="Affiliate activity"><Table headers={["Event","Rate","Commission","Status","Created"]}>{commissions.map((item) => <tr key={item.id}><td>{(item.events as unknown as { title?: string } | null)?.title || "Event"}</td><td>{item.rate}%</td><td>{money(item.amount_minor,item.currency)}</td><td>{item.status}</td><td>{date(item.created_at)}</td></tr>)}</Table></AdminSection>
    <AdminSection title="Payouts & refunds"><Table headers={["Type","Amount","Status","Details","Created"]}>{(payoutsResult.data || []).map((item) => <tr key={item.id}><td>Payout · {item.source}</td><td>{money(item.amount_minor,item.currency)}</td><td>{item.status}</td><td>{item.failure_reason || "—"}</td><td>{date(item.created_at)}</td></tr>)}{(refundsResult.data || []).map((item) => { const order = item.orders as unknown as { total_minor?: number; currency?: string } | null; return <tr key={item.id}><td>Refund request</td><td>{money(order?.total_minor || 0,order?.currency)}</td><td>{item.status}</td><td>{item.reason}</td><td>{date(item.created_at)}</td></tr>; })}</Table></AdminSection>
  </section></main>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <article><span>{label}</span><strong>{value}</strong></article>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="admin-detail-info"><span>{label}</span><strong>{value}</strong></div>; }
function DetailCard({ title, children }: { title: string; children: ReactNode }) { return <article className="admin-detail-card"><h2>{title}</h2>{children}</article>; }
function AdminSection({ title, children }: { title: string; children: ReactNode }) { return <section className="admin-detail-section"><h2>{title}</h2>{children}</section>; }
function Table({ headers, children }: { headers: string[]; children: ReactNode }) { return <div className="admin-table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
