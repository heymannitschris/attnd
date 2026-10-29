import { NextResponse } from "next/server";
import { getAdminActor } from "@/lib/admin-auth";
import { canManageAdminTeam, type AdminRole } from "@/lib/admin-permissions";

const roles = new Set<AdminRole>(["super_admin", "admin", "support", "finance", "moderator"]);

export async function POST(request: Request) {
  const actor = await getAdminActor();
  if (!actor || !canManageAdminTeam(actor.role)) return NextResponse.json({ error: "Superadmin access required" }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: string; targetId?: string; email?: string; role?: string } | null;
  const action = String(body?.action || "");
  const targetId = String(body?.targetId || "");
  const requestedRole = String(body?.role || "support") as AdminRole;
  if (!roles.has(requestedRole)) return NextResponse.json({ error: "Invalid admin role" }, { status: 400 });
  const { admin, user } = actor;

  if (action === "invite-admin") {
    const email = String(body?.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let invitedUser = existing.data?.users.find((item) => item.email?.toLowerCase() === email);
    if (!invitedUser) {
      const invitation = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${new URL(request.url).origin}/admin/login` });
      if (invitation.error || !invitation.data.user) return NextResponse.json({ error: invitation.error?.message || "Admin invitation failed" }, { status: 400 });
      invitedUser = invitation.data.user;
    }
    const { error } = await admin.from("admin_users").upsert({ user_id: invitedUser.id, role: requestedRole, active: true }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await admin.from("admin_audit_log").insert({ admin_user_id: user.id, action: "invite-admin", target_type: "admin_user", target_id: invitedUser.id, note: `${email} · ${requestedRole}` });
    return NextResponse.json({ updated: true });
  }

  if (!targetId) return NextResponse.json({ error: "Admin user is required" }, { status: 400 });
  if (targetId === user.id && (action === "deactivate-admin" || (action === "update-admin-role" && requestedRole !== "super_admin"))) return NextResponse.json({ error: "You cannot remove your own Superadmin access" }, { status: 400 });
  const { data: current } = await admin.from("admin_users").select("role,active").eq("user_id", targetId).maybeSingle();
  if (!current) return NextResponse.json({ error: "Admin account not found" }, { status: 404 });
  if (current.role === "super_admin" && current.active && (action === "deactivate-admin" || (action === "update-admin-role" && requestedRole !== "super_admin"))) {
    const { count } = await admin.from("admin_users").select("user_id", { count: "exact", head: true }).eq("role", "super_admin").eq("active", true);
    if ((count || 0) <= 1) return NextResponse.json({ error: "At least one active Superadmin is required" }, { status: 409 });
  }
  if (action === "update-admin-role") {
    const { error } = await admin.from("admin_users").update({ role: requestedRole }).eq("user_id", targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else if (action === "deactivate-admin" || action === "reactivate-admin") {
    const { error } = await admin.from("admin_users").update({ active: action === "reactivate-admin" }).eq("user_id", targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else return NextResponse.json({ error: "Unknown admin team action" }, { status: 400 });
  await admin.from("admin_audit_log").insert({ admin_user_id: user.id, action, target_type: "admin_user", target_id: targetId, note: action === "update-admin-role" ? requestedRole : "" });
  return NextResponse.json({ updated: true });
}
