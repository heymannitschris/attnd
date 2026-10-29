import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import type { AdminData } from "@/components/admin/AdminDashboard";
import type { AdminSectionName } from "@/components/admin/AdminSidebar";

export const metadata: Metadata = { title: "Admin | Attnd", robots: { index: false, follow: false } };
const adminSections: AdminSectionName[] = ["Overview", "Users", "Events", "Affiliates", "Payouts", "Local Reviews", "Reports", "Refunds", "Payments", "Activity Log", "Admin Team"];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { admin, role, user } = await requireAdmin();
  const requestedTab = (await searchParams).tab;
  const initialTab: AdminSectionName = adminSections.includes(requestedTab as AdminSectionName) && (requestedTab !== "Admin Team" || role === "super_admin") ? requestedTab as AdminSectionName : "Overview";
  const [profilesResult, authResult, eventsResult, ordersResult, localsResult, reportsResult, refundsResult, paymentCasesResult, ticketsCount, payoutsResult, affiliateVisitsResult, affiliateCommissionsResult, affiliateVisitsCount, auditResult, adminUsersResult] = await Promise.all([
    admin.from("profiles").select("id,username,first_name,avatar_url,city,account_status,suspension_reason,created_at").order("created_at", { ascending: false }).limit(1000),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("events").select("id,slug,title,status,admin_suspended,admin_suspension_reason,starts_at,created_at,profiles!events_host_id_fkey(first_name,username)").order("created_at", { ascending: false }).limit(1000),
    admin.from("orders").select("id,payment_status,currency,total_minor,platform_fee_minor,stripe_payment_intent_id,created_at,paid_at,events(title,slug),profiles!orders_buyer_id_fkey(first_name,username)").order("created_at", { ascending: false }).limit(150),
    admin.from("local_memberships").select("id,user_id,locality,status,proof_storage_path,proof_original_name,submitted_at,review_note,profiles!local_memberships_user_id_fkey(first_name,username)").order("submitted_at", { ascending: false }).limit(100),
    admin.from("event_live_moment_reports").select("id,reason,status,created_at,event_live_moments(id,caption,public_url,status,events(id,title,slug)),profiles!event_live_moment_reports_reporter_id_fkey(first_name,username)").order("created_at", { ascending: false }).limit(100),
    admin.from("refund_requests").select("id,order_id,reason,status,resolution_note,created_at,profiles!refund_requests_requester_id_fkey(first_name,username),orders(payment_status,total_minor,currency,stripe_payment_intent_id,events(title,slug))").order("created_at", { ascending: false }).limit(100),
    admin.from("admin_payment_cases").select("order_id,status,note,reviewed_at"),
    admin.from("tickets").select("id", { count: "exact", head: true }),
    admin.from("payout_requests").select("id,user_id,source,status,amount_minor,fee_minor,currency,method,provider_transfer_id,created_at,paid_at,failure_reason,profiles!payout_requests_user_id_fkey(first_name,username)").order("created_at", { ascending: false }).limit(1000),
    admin.from("affiliate_link_visits").select("affiliate_user_id,event_id,created_at").order("created_at", { ascending: false }).limit(2000),
    admin.from("affiliate_commissions").select("id,affiliate_user_id,event_id,rate,amount_minor,currency,status,created_at,available_at,profiles!affiliate_commissions_affiliate_user_id_fkey(first_name,username),events(title,slug),orders(payment_status,total_minor)").order("created_at", { ascending: false }).limit(500),
    admin.from("affiliate_link_visits").select("id", { count: "exact", head: true }),
    admin.from("admin_audit_log").select("id,action,target_type,target_id,note,metadata,created_at,profiles!admin_audit_log_admin_user_id_fkey(first_name,username)").order("created_at", { ascending: false }).limit(1000),
    admin.from("admin_users").select("user_id,role,active,created_at,profiles!admin_users_user_id_fkey(first_name,username)").order("created_at", { ascending: true }),
  ]);
  const authEmails = new Map((authResult.data?.users || []).map((user) => [user.id, user.email || ""]));
  const { data: reviewReportsData } = await admin.from("event_review_reports").select("id,reason,status,created_at,profiles!event_review_reports_reporter_id_fkey(first_name,username),event_reviews(id,rating,body,status,events(id,title,slug),profiles!event_reviews_user_id_fkey(first_name,username))").order("created_at", { ascending: false }).limit(100);
  const profiles = (profilesResult.data || []).map((profile) => ({ ...profile, email: authEmails.get(profile.id) || "" }));
  const locals = await Promise.all((localsResult.data || []).map(async (membership) => ({
    ...membership,
    proof_storage_path: undefined,
    proof_url: membership.proof_storage_path ? (await admin.storage.from("local-membership-proofs").createSignedUrl(membership.proof_storage_path, 600)).data?.signedUrl || null : null,
  })));
  const orders = ordersResult.data || [];
  const paidOrders = orders.filter((order) => order.payment_status === "paid" || order.payment_status === "refunded");
  const eventHosts = new Set((eventsResult.data || []).map((event) => (event.profiles as unknown as { username?: string } | null)?.username).filter(Boolean));
  const paymentCaseMap = new Map((paymentCasesResult.data || []).map((item) => [item.order_id, item]));
  const paymentIssues = orders.filter((order) => order.payment_status === "failed" || (order.payment_status === "pending" && Date.now() - new Date(order.created_at).getTime() > 30 * 60 * 1000)).map((order) => ({ ...order, case: paymentCaseMap.get(order.id) || null }));
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const affiliateMap = new Map<string, { userId: string; name: string; username: string; clicks: number; bookings: number; commissionMinor: number; currency: string; availableMinor: number; lastActivity: string }>();
  const affiliateFor = (userId: string) => {
    const profile = profileMap.get(userId);
    const current = affiliateMap.get(userId) || { userId, name: profile?.first_name || profile?.username || "Affiliate", username: profile?.username || "", clicks: 0, bookings: 0, commissionMinor: 0, currency: "thb", availableMinor: 0, lastActivity: "" };
    affiliateMap.set(userId, current); return current;
  };
  for (const visit of affiliateVisitsResult.data || []) { const item = affiliateFor(visit.affiliate_user_id); item.clicks += 1; if (!item.lastActivity || visit.created_at > item.lastActivity) item.lastActivity = visit.created_at; }
  for (const commission of affiliateCommissionsResult.data || []) { const item = affiliateFor(commission.affiliate_user_id); if (commission.status !== "reversed") { item.bookings += 1; item.commissionMinor += commission.amount_minor; if (commission.status === "available") item.availableMinor += commission.amount_minor; } item.currency = commission.currency; if (!item.lastActivity || commission.created_at > item.lastActivity) item.lastActivity = commission.created_at; }
  const affiliates = [...affiliateMap.values()].sort((a, b) => b.commissionMinor - a.commissionMinor || b.clicks - a.clicks);
  const affiliateCommissionMinor = (affiliateCommissionsResult.data || []).filter((item) => item.status !== "reversed").reduce((sum, item) => sum + item.amount_minor, 0);
  const affiliateSales = (affiliateCommissionsResult.data || []).filter((item) => item.status !== "reversed").length;
  const refundTargetMap = new Map((refundsResult.data || []).map((item) => [item.id, `/admin/orders/${item.order_id}`]));
  const localTargetMap = new Map((localsResult.data || []).map((item) => [item.id, `/admin/users/${item.user_id}`]));
  const reportTargetMap = new Map((reportsResult.data || []).map((item) => { const moment = item.event_live_moments as unknown as { events?: { id?: string } | null } | null; return [item.id, moment?.events?.id ? `/admin/events/${moment.events.id}` : ""]; }));
  const audits = (auditResult.data || []).map((item) => ({ ...item, targetHref: item.target_type === "user" ? `/admin/users/${item.target_id}` : item.target_type === "event" ? `/admin/events/${item.target_id}` : item.target_type === "payment" ? `/admin/orders/${item.target_id}` : item.target_type === "refund" ? refundTargetMap.get(item.target_id) || "" : item.target_type === "local_membership" ? localTargetMap.get(item.target_id) || "" : item.target_type === "report" ? reportTargetMap.get(item.target_id) || "" : item.target_type === "admin_user" ? "/admin?tab=Admin%20Team" : "" }));
  const adminTeam = (adminUsersResult.data || []).map((item) => { const profile = item.profiles as unknown as { first_name?: string | null; username?: string | null } | null; return { userId: item.user_id, name: profile?.first_name || profile?.username || "Administrator", username: profile?.username || "", email: authEmails.get(item.user_id) || "", role: item.role, active: item.active, createdAt: item.created_at }; });
  const data = {
    role,
    adminUser: { name: profileMap.get(user.id)?.first_name || profileMap.get(user.id)?.username || user.email?.split("@")[0] || "Admin", avatarUrl: profileMap.get(user.id)?.avatar_url || null },
    currentAdminUserId: user.id,
    adminTeam,
    kpis: {
      users: profiles.length,
      hosts: eventHosts.size,
      events: eventsResult.data?.length || 0,
      publishedEvents: (eventsResult.data || []).filter((event) => event.status === "published" && !event.admin_suspended).length,
      tickets: ticketsCount.count || 0,
      gmvMinor: paidOrders.reduce((sum, order) => sum + Number(order.total_minor || 0), 0),
      platformRevenueMinor: paidOrders.reduce((sum, order) => sum + Number(order.platform_fee_minor || 0), 0),
      pendingLocals: locals.filter((item) => item.status === "pending").length,
      openReports: (reportsResult.data || []).filter((item) => item.status === "open").length + (reviewReportsData || []).filter((item) => item.status === "open").length,
      openRefunds: (refundsResult.data || []).filter((item) => item.status === "open" || item.status === "needs_info").length,
      paymentIssues: paymentIssues.filter((item) => item.case?.status !== "resolved" && item.case?.status !== "ignored").length,
      affiliates: affiliates.length,
      affiliateClicks: affiliateVisitsCount.count || 0,
      affiliateSales,
      affiliateCommissionMinor,
    },
    profiles,
    events: eventsResult.data || [],
    locals,
    reports: reportsResult.data || [],
    reviewReports: reviewReportsData || [],
    refunds: refundsResult.data || [],
    paymentIssues,
    failedPayouts: (payoutsResult.data || []).filter((item) => item.status === "failed"),
    payouts: payoutsResult.data || [],
    affiliates,
    affiliateCommissions: affiliateCommissionsResult.data || [],
    audits,
  };
  return <AdminDashboard data={data as unknown as AdminData} initialTab={initialTab} />;
}
