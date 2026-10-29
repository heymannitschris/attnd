import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminOrderActions } from "@/components/admin/AdminOrderActions";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

type Props = { params: Promise<{ id: string }> };
const money = (minor: number, currency = "thb") => new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
const date = (value?: string | null) => value ? new Date(value).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }) : "—";
const person = (value: unknown) => { const item = value as { id?: string; first_name?: string | null; username?: string | null; email?: string | null } | null; return item?.first_name || (item?.username ? `@${item.username}` : item?.email || "Member"); };

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) notFound();
  const { admin, role, user } = await requireAdmin();
  const [orderResult, itemsResult, attendeesResult, ticketsResult, refundResult, caseResult, commissionResult, allocationsResult, adminProfileResult] = await Promise.all([
    admin.from("orders").select("id,buyer_id,event_id,affiliate_user_id,payment_status,currency,subtotal_minor,platform_fee_minor,total_minor,stripe_checkout_session_id,stripe_payment_intent_id,created_at,paid_at,events(id,title,slug,starts_at,venue_name,city),profiles!orders_buyer_id_fkey(id,first_name,username)").eq("id", id).maybeSingle(),
    admin.from("order_items").select("id,quantity,unit_price_minor,ticket_types(id,name,price_minor,currency)").eq("order_id", id),
    admin.from("order_attendees").select("position,first_name,last_name,email").eq("order_id", id).order("position"),
    admin.from("tickets").select("id,status,attendee_name,attendee_email,created_at,ticket_types(name),profiles!tickets_owner_id_fkey(id,first_name,username),ticket_checkins(checked_in_at,profiles!ticket_checkins_checked_in_by_fkey(first_name,username))").eq("order_id", id).order("created_at"),
    admin.from("refund_requests").select("id,status,reason,resolution_note,created_at,updated_at,reviewed_at,profiles!refund_requests_reviewed_by_fkey(first_name,username)").eq("order_id", id).maybeSingle(),
    admin.from("admin_payment_cases").select("status,note,reviewed_at,updated_at,profiles!admin_payment_cases_reviewed_by_fkey(first_name,username)").eq("order_id", id).maybeSingle(),
    admin.from("affiliate_commissions").select("id,rate,amount_minor,currency,status,available_at,profiles!affiliate_commissions_affiliate_user_id_fkey(id,first_name,username)").eq("order_id", id).maybeSingle(),
    admin.from("revenue_allocations").select("user_id,role,amount_minor,currency,available_at,status,profiles!revenue_allocations_user_id_fkey(id,first_name,username)").eq("order_id", id).order("amount_minor", { ascending: false }),
    admin.from("profiles").select("first_name,username,avatar_url").eq("id", user.id).maybeSingle(),
  ]);
  const order = orderResult.data;
  if (!order) notFound();
  const event = order.events as unknown as { id: string; title: string; slug: string; starts_at?: string | null; venue_name?: string | null; city?: string | null } | null;
  const buyer = order.profiles as unknown as { id: string; first_name?: string | null; username?: string | null } | null;
  const refund = refundResult.data;
  const paymentCase = caseResult.data;
  const tickets = ticketsResult.data || [];
  const usedTickets = tickets.filter((ticket) => ticket.status === "used").length;
  const affiliateCommission = commissionResult.data;
  const hostNet = (allocationsResult.data || []).filter((item) => item.status !== "reversed").reduce((sum, item) => sum + item.amount_minor, 0);
  const adminName = adminProfileResult.data?.first_name || adminProfileResult.data?.username || user.email?.split("@")[0] || "Admin";
  return <main className="admin-shell"><AdminSidebar active="Payments" role={role} name={adminName} avatarUrl={adminProfileResult.data?.avatar_url} /><section className="admin-detail-page">
    <header className="admin-detail-top"><Link href="/admin">← Admin dashboard</Link><span>ORDER RECORD</span></header>
    <section className="admin-detail-hero"><div><p>SUPERADMIN · ORDER DETAIL</p><h1>Order {order.id.slice(0, 8)}</h1><span>{event?.title || "Event order"} · Created {date(order.created_at)}</span></div><div><span className="admin-status" data-status={order.payment_status}>{order.payment_status}</span></div></section>
    <section className="admin-detail-kpis"><Metric label="Total" value={money(order.total_minor, order.currency)} /><Metric label="Subtotal" value={money(order.subtotal_minor, order.currency)} /><Metric label="Platform fee" value={money(order.platform_fee_minor, order.currency)} /><Metric label="Allocated revenue" value={money(hostNet, order.currency)} /><Metric label="Tickets" value={tickets.length} /><Metric label="Checked in" value={usedTickets} /></section>
    <AdminOrderActions orderId={order.id} paymentCaseStatus={paymentCase?.status} refundId={refund?.id} refundStatus={refund?.status} canRefund={order.payment_status === "paid" && Boolean(order.stripe_payment_intent_id)} role={role} />
    <section className="admin-detail-grid"><DetailCard title="Payment"><Info label="Status" value={order.payment_status} /><Info label="Paid at" value={date(order.paid_at)} /><Info label="Currency" value={order.currency.toUpperCase()} /><Info label="Stripe Payment Intent" value={order.stripe_payment_intent_id || "—"} /><Info label="Stripe Checkout Session" value={order.stripe_checkout_session_id || "—"} /><Info label="Payment case" value={paymentCase ? `${paymentCase.status}${paymentCase.note ? ` · ${paymentCase.note}` : ""}` : "None"} /></DetailCard><DetailCard title="Buyer & event"><Info label="Buyer" value={person(buyer)} /><Info label="Buyer ID" value={order.buyer_id} /><Info label="Event" value={event?.title || "—"} /><Info label="Starts" value={date(event?.starts_at)} /><Info label="Venue" value={[event?.venue_name,event?.city].filter(Boolean).join(", ") || "—"} />{buyer?.id && <div className="admin-detail-links"><Link href={`/admin/users/${buyer.id}`}>Open buyer record</Link>{event?.id && <Link href={`/admin/events/${event.id}`}>Open event record</Link>}</div>}</DetailCard></section>
    <AdminSection title="Order items"><Table headers={["Ticket type","Quantity","Unit price","Line total"]}>{(itemsResult.data || []).map((item) => { const ticketType = item.ticket_types as unknown as { name?: string } | null; return <tr key={item.id}><td>{ticketType?.name || "Admission"}</td><td>{item.quantity}</td><td>{money(item.unit_price_minor,order.currency)}</td><td>{money(item.unit_price_minor * item.quantity,order.currency)}</td></tr>; })}</Table></AdminSection>
    <AdminSection title="Tickets & check-ins"><Table headers={["Ticket","Attendee","Owner","Type","Status","Check-in"]}>{tickets.map((ticket) => { const checkin = (ticket.ticket_checkins as unknown as Array<{ checked_in_at?: string; profiles?: unknown }> | null)?.[0]; return <tr key={ticket.id}><td><code>{ticket.id.slice(0,8)}</code></td><td>{ticket.attendee_name || ticket.attendee_email || "Guest"}</td><td>{person(ticket.profiles)}</td><td>{(ticket.ticket_types as unknown as { name?: string } | null)?.name || "Admission"}</td><td><span className="admin-status" data-status={ticket.status}>{ticket.status}</span></td><td>{checkin ? `${date(checkin.checked_in_at)} · ${person(checkin.profiles)}` : "Not checked in"}</td></tr>; })}</Table></AdminSection>
    <section className="admin-detail-grid"><DetailCard title="Refund"><Info label="Request" value={refund ? refund.status : "None"} /><Info label="Created" value={date(refund?.created_at)} /><Info label="Reason" value={refund?.reason || "—"} /><Info label="Resolution" value={refund?.resolution_note || "—"} /><Info label="Reviewed" value={date(refund?.reviewed_at)} /></DetailCard><DetailCard title="Affiliate attribution"><Info label="Affiliate" value={affiliateCommission ? person(affiliateCommission.profiles) : "None"} /><Info label="Rate" value={affiliateCommission ? `${affiliateCommission.rate}%` : "—"} /><Info label="Commission" value={affiliateCommission ? money(affiliateCommission.amount_minor, affiliateCommission.currency) : "—"} /><Info label="Status" value={affiliateCommission?.status || "—"} /><Info label="Available" value={date(affiliateCommission?.available_at)} /></DetailCard></section>
    <AdminSection title="Revenue distribution"><Table headers={["Recipient","Role","Amount","Status","Available"]}>{(allocationsResult.data || []).map((item) => <tr key={`${item.user_id}-${item.role}`}><td><Link href={`/admin/users/${item.user_id}`}>{person(item.profiles)}</Link></td><td>{item.role}</td><td>{money(item.amount_minor,item.currency)}</td><td>{item.status}</td><td>{date(item.available_at)}</td></tr>)}</Table></AdminSection>
    {(attendeesResult.data || []).length > 0 && <AdminSection title="Checkout attendees"><Table headers={["Position","Name","Email"]}>{(attendeesResult.data || []).map((item) => <tr key={item.position}><td>{item.position}</td><td>{item.first_name} {item.last_name}</td><td>{item.email || "—"}</td></tr>)}</Table></AdminSection>}
  </section></main>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <article><span>{label}</span><strong>{value}</strong></article>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="admin-detail-info"><span>{label}</span><strong>{value}</strong></div>; }
function DetailCard({ title, children }: { title: string; children: ReactNode }) { return <article className="admin-detail-card"><h2>{title}</h2>{children}</article>; }
function AdminSection({ title, children }: { title: string; children: ReactNode }) { return <section className="admin-detail-section"><h2>{title}</h2>{children}</section>; }
function Table({ headers, children }: { headers: string[]; children: ReactNode }) { return <div className="admin-table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
