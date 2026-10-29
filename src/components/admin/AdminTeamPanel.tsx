"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Member = { userId: string; name: string; username: string; email: string; role: string; active: boolean; createdAt: string };
const roles = ["super_admin", "admin", "support", "finance", "moderator"];
const labels: Record<string, string> = { super_admin: "Superadmin", admin: "Admin", support: "Support", finance: "Finance", moderator: "Moderator" };

export function AdminTeamPanel({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("support");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  async function update(payload: Record<string, string>) {
    const key = `${payload.action}:${payload.targetId || payload.email}`; setBusy(key); setNotice("");
    const response = await fetch("/api/admin/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json() as { error?: string };
    setBusy(""); setNotice(response.ok ? "Admin team updated." : result.error || "Update failed.");
    if (response.ok) { setEmail(""); router.refresh(); }
  }
  return <div className="admin-team-panel">
    <section className="admin-team-invite"><div><span>ADMIN ACCESS</span><h2>Invite an administrator</h2><p>An existing user receives access immediately. New users receive an invitation email.</p></div><form onSubmit={(event) => { event.preventDefault(); void update({ action: "invite-admin", email, role: inviteRole }); }}><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" /><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>{roles.map((role) => <option key={role} value={role}>{labels[role]}</option>)}</select><button type="submit" disabled={Boolean(busy)}>{busy.startsWith("invite-admin") ? "Inviting…" : "Invite admin"}</button></form></section>
    <section className="admin-role-guide">{roles.map((role) => <article key={role}><strong>{labels[role]}</strong><span>{role === "super_admin" ? "Full access and team management" : role === "admin" ? "All operational actions" : role === "support" ? "Read-only operational access" : role === "finance" ? "Payments, refunds and finance actions" : "Users, events, Locals and reports"}</span></article>)}</section>
    <div className="admin-table-wrap"><table><thead><tr><th>Administrator</th><th>Email</th><th>Role</th><th>Status</th><th>Added</th><th>Action</th></tr></thead><tbody>{members.map((member) => <tr key={member.userId}><td><strong>{member.name}</strong><small>@{member.username || "member"}{member.userId === currentUserId ? " · You" : ""}</small></td><td>{member.email}</td><td><select value={member.role} disabled={Boolean(busy) || member.userId === currentUserId} onChange={(event) => void update({ action: "update-admin-role", targetId: member.userId, role: event.target.value })}>{roles.map((role) => <option key={role} value={role}>{labels[role]}</option>)}</select></td><td><span className="admin-status" data-status={member.active ? "active" : "suspended"}>{member.active ? "active" : "inactive"}</span></td><td>{new Date(member.createdAt).toLocaleDateString()}</td><td>{member.userId === currentUserId ? "—" : <button type="button" className={member.active ? "danger" : ""} disabled={Boolean(busy)} onClick={() => void update({ action: member.active ? "deactivate-admin" : "reactivate-admin", targetId: member.userId, role: member.role })}>{member.active ? "Deactivate" : "Reactivate"}</button>}</td></tr>)}</tbody></table></div>
    {notice && <button className="admin-toast" type="button" onClick={() => setNotice("")}>{notice}</button>}
  </div>;
}
