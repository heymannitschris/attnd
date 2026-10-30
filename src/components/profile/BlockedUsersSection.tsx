"use client";

import { useCallback, useEffect, useState } from "react";
import { confirmDialog } from "@/lib/dialog";

type BlockedUser = { id: string; firstName: string | null; username: string | null; avatarUrl: string | null };

export function BlockedUsersSection() {
  const [users, setUsers] = useState<BlockedUser[] | null>(null);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/safety", { cache: "no-store" }).catch(() => null);
    const data = await response?.json().catch(() => null) as { blocked?: BlockedUser[]; error?: string } | null;
    if (!response?.ok) { setNotice(data?.error || "Blocked users could not be loaded."); setUsers([]); return; }
    setUsers(data?.blocked || []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const unblock = async (user: BlockedUser) => {
    const name = user.firstName || (user.username ? `@${user.username}` : "this user");
    if (!(await confirmDialog(`Unblock ${name}? They will be able to see your profile and contact you again.`, { title: "Unblock user", confirmLabel: "Unblock" }))) return;
    setBusyId(user.id); setNotice("");
    const response = await fetch("/api/safety", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "unblock", targetId: user.id }) }).catch(() => null);
    setBusyId("");
    if (!response?.ok) { setNotice("Unblock failed. Please try again."); return; }
    setUsers((current) => (current || []).filter((item) => item.id !== user.id));
    setNotice(`${name} was unblocked.`);
  };

  return <div className="profile-settings-body">
    {users === null ? <p className="profile-settings-empty">Loading blocked users…</p> : users.length ? <div className="profile-payment-list">{users.map((user) => <article key={user.id}>
      <p><strong>{user.firstName || "Attnd member"}</strong>{user.username && <small>@{user.username}</small>}</p>
      <button type="button" disabled={busyId === user.id} onClick={() => void unblock(user)}>{busyId === user.id ? "Unblocking…" : "Unblock"}</button>
    </article>)}</div> : <p className="profile-settings-empty">You haven&apos;t blocked anyone.</p>}
    {notice && <p role="status" className="profile-settings-empty">{notice}</p>}
  </div>;
}
