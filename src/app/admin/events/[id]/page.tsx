import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminModerationButtons } from "@/components/admin/AdminModerationButtons";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

type Props = { params: Promise<{ id: string }> };
const money = (minor: number, currency = "thb") => new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
const date = (value?: string | null) => value ? new Date(value).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }) : "—";
const person = (value: unknown) => { const item = value as { first_name?: string | null; username?: string | null } | null; return item?.first_name || (item?.username ? `@${item.username}` : "Member"); };

export default async function AdminEventDetailPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) notFound();
  const { admin, role, user } = await requireAdmin();
  const [eventResult, ordersResult, ticketsResult, checkinsCount, guestsResult, cohostsResult, teamResult, staffResult, localRuleResult, commissionsResult, reportsResult, momentsCount, savesCount, adminProfileResult] = await Promise.all([
    admin.from("events").select("id,slug,title,description,status,category,audience,starts_at,ends_at,timezone,venue_name,address,city,cover_url,affiliate_commission,max_attendees,admin_suspended,admin_suspension_reason,admin_suspended_at,created_at,published_at,profiles!events_host_id_fkey(id,first_name,username,city)").eq("id", id).maybeSingle(),
    admin.from("orders").select("id,buyer_id,payment_status,total_minor,subtotal_minor,platform_fee_minor,currency,created_at,paid_at,profiles!orders_buyer_id_fkey(first_name,username)").eq("event_id", id).order("created_at", { ascending: false }).limit(200),
    admin.from("tickets").select("id,status,created_at,ticket_types(name),profiles!tickets_owner_id_fkey(first_name,username)").eq("event_id", id).order("created_at", { ascending: false }).limit(200),
    admin.from("ticket_checkins").select("id", { count: "exact", head: true }).eq("event_id", id),
    admin.from("event_guestlist_entries").select("id,guest_name,plus_ones,status,created_at").eq("event_id", id).order("created_at", { ascending: false }),
    admin.from("event_cohosts").select("user_id,status,revenue_share_percent,profiles!event_cohosts_user_id_fkey(first_name,username)").eq("event_id", id),
    admin.from("event_team_members").select("user_id,role_title,status,compensation_type,fixed_amount_minor,compensation_percent,currency,profiles!event_team_members_user_id_fkey(first_name,username)").eq("event_id", id),
    admin.from("event_staff").select("user_id,status,profiles!event_staff_user_id_fkey(first_name,username)").eq("event_id", id).eq("role", "check_in"),
    admin.from("event_local_access_rules").select("enabled,locality,benefit_type,discount_percent,capacity,redeemed_count").eq("event_id", id).maybeSingle(),
    admin.from("affiliate_commissions").select("id,rate,amount_minor,currency,status,created_at,profiles!affiliate_commissions_affiliate_user_id_fkey(first_name,username)").eq("event_id", id).order("created_at", { ascending: false }),
    admin.from("event_live_moment_reports").select("id,status,reason,created_at,event_live_moments!inner(event_id)").eq("event_live_moments.event_id", id),
    admin.from("event_live_moments").select("id", { count: "exact", head: true }).eq("event_id", id),
    admin.from("event_saves").select("user_id", { count: "exact", head: true }).eq("event_id", id),
    admin.from("profiles").select("first_name,username,avatar_url").eq("id", user.id).maybeSingle(),
  ]);
  const event = eventResult.data;
  if (!event) notFound();
  const orders = ordersResult.data || [];
  const paid = orders.filter((order) => order.payment_status === "paid" || order.payment_status === "refunded");
  const tickets = ticketsResult.data || [];
  const commissions = commissionsResult.data || [];
  const currency = paid[0]?.currency || commissions[0]?.currency || "thb";
  const adminName = adminProfileResult.data?.first_name || adminProfileResult.data?.username || user.email?.split("@")[0] || "Admin";
  return <main className="admin-shell"><AdminSidebar active="Events" role={role} name={adminName} avatarUrl={adminProfileResult.data?.avatar_url} /><section className="admin-detail-page">
    <header className="admin-detail-top"><Link href="/admin">← Admin dashboard</Link><div>{(event.profiles as unknown as { id?: string } | null)?.id === user.id && <Link href={`/create?id=${event.id}`}>Edit event</Link>}<Link href={`/events/${event.slug}`}>Open public event ↗</Link></div></header>
    <section className="admin-detail-hero"><div><p>SUPERADMIN · EVENT DETAIL</p><h1>{event.title}</h1><span>{date(event.starts_at)} · {[event.venue_name,event.city].filter(Boolean).join(", ") || "Location not set"}</span></div><div><span className="admin-status" data-status={event.admin_suspended ? "suspended" : event.status}>{event.admin_suspended ? "suspended" : event.status}</span><AdminModerationButtons targetId={id} targetType="event" suspended={event.admin_suspended} role={role} /></div></section>
    {event.admin_suspension_reason && <p className="admin-detail-warning"><strong>Suspension reason:</strong> {event.admin_suspension_reason}</p>}
    <section className="admin-detail-kpis"><Metric label="Gross ticket volume" value={money(paid.reduce((sum,item)=>sum+item.total_minor,0),currency)} /><Metric label="Platform fees" value={money(paid.reduce((sum,item)=>sum+item.platform_fee_minor,0),currency)} /><Metric label="Tickets issued" value={tickets.length} /><Metric label="Check-ins" value={checkinsCount.count || 0} /><Metric label="Saved by users" value={savesCount.count || 0} /><Metric label="Live moments" value={momentsCount.count || 0} /></section>
    <section className="admin-detail-grid"><DetailCard title="Event information"><Info label="Host" value={person(event.profiles)} /><Info label="Category" value={event.category || "—"} /><Info label="Audience" value={event.audience} /><Info label="Starts" value={date(event.starts_at)} /><Info label="Ends" value={date(event.ends_at)} /><Info label="Timezone" value={event.timezone} /><Info label="Capacity" value={event.max_attendees ? String(event.max_attendees) : "Unlimited"} /><Info label="Affiliate rate" value={`${event.affiliate_commission}%`} /></DetailCard><DetailCard title="Access & moderation"><Info label="Guestlist entries" value={String(guestsResult.data?.length || 0)} /><Info label="Co-hosts" value={String(cohostsResult.data?.length || 0)} /><Info label="Team members" value={String(teamResult.data?.length || 0)} /><Info label="Check-in staff" value={String(staffResult.data?.length || 0)} /><Info label="Open reports" value={String((reportsResult.data || []).filter((item)=>item.status === "open").length)} /><Info label="Local benefit" value={localRuleResult.data?.enabled ? `${localRuleResult.data.benefit_type === "free" ? "Free" : `${localRuleResult.data.discount_percent}% off`} · ${localRuleResult.data.locality}` : "Disabled"} /></DetailCard></section>
    <AdminSection title="Orders"><Table headers={["Order","Buyer","Subtotal","Fee","Total","Status","Created"]}>{orders.map((order)=><tr key={order.id}><td><Link href={`/admin/orders/${order.id}`}><code>{order.id.slice(0,8)}</code></Link></td><td>{person(order.profiles)}</td><td>{money(order.subtotal_minor,order.currency)}</td><td>{money(order.platform_fee_minor,order.currency)}</td><td>{money(order.total_minor,order.currency)}</td><td>{order.payment_status}</td><td>{date(order.created_at)}</td></tr>)}</Table></AdminSection>
    <AdminSection title="Tickets & entry"><Table headers={["Ticket","Owner","Type","Status","Created"]}>{tickets.map((ticket)=><tr key={ticket.id}><td><code>{ticket.id.slice(0,8)}</code></td><td>{person(ticket.profiles)}</td><td>{(ticket.ticket_types as unknown as { name?: string } | null)?.name || "Admission"}</td><td>{ticket.status}</td><td>{date(ticket.created_at)}</td></tr>)}</Table></AdminSection>
    <AdminSection title="Event team"><Table headers={["Member","Role","Agreement","Compensation","Status"]}>{(cohostsResult.data || []).map((item)=><tr key={`cohost-${item.user_id}`}><td><Link href={`/admin/users/${item.user_id}`}>{person(item.profiles)}</Link></td><td>Co-host</td><td>{item.revenue_share_percent}% revenue share</td><td>Percentage</td><td>{item.status}</td></tr>)}{(teamResult.data || []).map((item)=><tr key={`team-${item.user_id}`}><td><Link href={`/admin/users/${item.user_id}`}>{person(item.profiles)}</Link></td><td>{item.role_title}</td><td>{item.compensation_type === "fixed" ? money(item.fixed_amount_minor || 0,item.currency) : `${item.compensation_percent || 0}%`}</td><td>{item.compensation_type}</td><td>{item.status}</td></tr>)}{(staffResult.data || []).map((item)=><tr key={`staff-${item.user_id}`}><td><Link href={`/admin/users/${item.user_id}`}>{person(item.profiles)}</Link></td><td>Check-in staff</td><td>Entry access</td><td>—</td><td>{item.status}</td></tr>)}</Table></AdminSection>
    <AdminSection title="Affiliate sales"><Table headers={["Affiliate","Rate","Commission","Status","Created"]}>{commissions.map((item)=><tr key={item.id}><td>{person(item.profiles)}</td><td>{item.rate}%</td><td>{money(item.amount_minor,item.currency)}</td><td>{item.status}</td><td>{date(item.created_at)}</td></tr>)}</Table></AdminSection>
  </section></main>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <article><span>{label}</span><strong>{value}</strong></article>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="admin-detail-info"><span>{label}</span><strong>{value}</strong></div>; }
function DetailCard({ title, children }: { title: string; children: ReactNode }) { return <article className="admin-detail-card"><h2>{title}</h2>{children}</article>; }
function AdminSection({ title, children }: { title: string; children: ReactNode }) { return <section className="admin-detail-section"><h2>{title}</h2>{children}</section>; }
function Table({ headers, children }: { headers: string[]; children: ReactNode }) { return <div className="admin-table-wrap"><table><thead><tr>{headers.map((header)=><th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
