"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HostEvent = { id: string; title: string };
type EventInfo = { id: string; slug: string; title: string } | null;
type Membership = {
  id: string; event_id: string; role_title: string; compensation_type: "percentage" | "fixed";
  compensation_percent: number | null; fixed_amount_minor: number | null; currency: string; can_check_in: boolean;
  status: string; earnedMinor: number; availableMinor: number; events: EventInfo;
};
type ManagedMember = Omit<Membership, "event_id" | "events" | "availableMinor"> & {
  user_id: string; profiles: { first_name: string | null; username: string | null; avatar_url: string | null } | null;
};

const money = (minor: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);

export function TeamManagementPanel({ hostEvents, activeEventId }: { hostEvents: HostEvent[]; activeEventId?: string }) {
  const [eventId, setEventId] = useState(activeEventId || hostEvents[0]?.id || "");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [managedTeam, setManagedTeam] = useState<ManagedMember[]>([]);
  const [username, setUsername] = useState("");
  const [roleTitle, setRoleTitle] = useState("Security");
  const [compensationType, setCompensationType] = useState<"percentage" | "fixed">("fixed");
  const [compensationValue, setCompensationValue] = useState("150");
  const [currency, setCurrency] = useState("thb");
  const [canCheckIn, setCanCheckIn] = useState(false);
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => { if (activeEventId) setEventId(activeEventId); }, [activeEventId]);

  useEffect(() => {
    void fetch(`/api/team${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ""}`).then((response) => response.json()).then((team: { memberships?: Membership[]; managedTeam?: ManagedMember[] }) => {
      setMemberships(team.memberships || []);
      setManagedTeam(team.managedTeam || []);
    }).catch(() => setNotice("Team data could not be loaded."));
  }, [eventId, refresh]);

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice("");
    const response = await fetch("/api/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, username, roleTitle, compensationType, compensationValue: Number(compensationValue), currency, canCheckIn }) });
    const result = await response.json() as { error?: string };
    setNotice(response.ok ? "Team invitation sent." : result.error || "Invitation failed.");
    if (response.ok) { setUsername(""); setRefresh((value) => value + 1); }
  }

  async function respond(membershipId: string, status: "accepted" | "declined") {
    const response = await fetch("/api/team", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ membershipId, status }) });
    if (response.ok) setRefresh((value) => value + 1);
  }

  async function remove(membershipId: string) {
    const response = await fetch(`/api/team?membershipId=${encodeURIComponent(membershipId)}`, { method: "DELETE" });
    if (response.ok) setRefresh((value) => value + 1);
  }

  return <section className="dashboard-cohosting dashboard-team-management">
    <h2>Your Event Team Roles</h2>
    {memberships.length ? memberships.map((membership) => <article key={membership.id}>
      <div><Link href={membership.events ? `/events/${membership.events.slug}` : "#"}>{membership.role_title} · {membership.events?.title || "Event"}</Link><small>{membership.status === "accepted" ? `${membership.compensation_type === "percentage" ? `${membership.compensation_percent}% revenue share` : `${money(membership.fixed_amount_minor || 0, membership.currency)} fixed`} · ${membership.can_check_in ? "Scanner access" : "No scanner access"}` : "Invitation pending"}</small></div>
      {membership.status === "pending" ? <div className="dashboard-cohost-actions"><button type="button" onClick={() => void respond(membership.id, "accepted")}>Accept</button><button type="button" onClick={() => void respond(membership.id, "declined")}>Decline</button></div> : <strong>{money(membership.earnedMinor, membership.currency)}<small>Funded</small></strong>}
    </article>) : <p>No team invitations yet.</p>}

    <h2>Invite a Team Member</h2>
    <p className="dashboard-role-description">Add Security, Cleaning, Management or any other role. Choose a fixed fee or a percentage of ticket revenue. Funds are recorded automatically and become withdrawable after the event hold.</p>
    <form onSubmit={(event) => void invite(event)}>
      {!activeEventId && <label>Event<select value={eventId} onChange={(event) => setEventId(event.target.value)} required>{hostEvents.map((hostEvent) => <option value={hostEvent.id} key={hostEvent.id}>{hostEvent.title}</option>)}</select></label>}
      <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="@username" required /></label>
      <label>Role<input list="team-role-options" value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} placeholder="Security" required /><datalist id="team-role-options"><option value="Security" /><option value="Cleaning" /><option value="Event Management" /><option value="Production" /><option value="Bar Staff" /><option value="DJ / Artist" /></datalist></label>
      <label>Compensation<select value={compensationType} onChange={(event) => setCompensationType(event.target.value as "percentage" | "fixed")}><option value="fixed">Fixed amount</option><option value="percentage">Revenue share</option></select></label>
      <div className="dashboard-team-compensation"><label>{compensationType === "percentage" ? "Revenue share (%)" : "Fixed amount"}<input type="number" min={compensationType === "percentage" ? "0.01" : "50"} max={compensationType === "percentage" ? "100" : undefined} step={compensationType === "percentage" ? "0.01" : "0.01"} value={compensationValue} onChange={(event) => setCompensationValue(event.target.value)} required /></label>{compensationType === "fixed" && <label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="thb">THB</option><option value="eur">EUR</option><option value="usd">USD</option><option value="gbp">GBP</option></select></label>}</div>
      <label className="dashboard-team-check"><input type="checkbox" checked={canCheckIn} onChange={(event) => setCanCheckIn(event.target.checked)} /> Allow QR ticket check-in</label>
      <button type="submit" disabled={!hostEvents.length}>Send Team Invitation</button>
      {notice && <p role="status">{notice}</p>}
    </form>

    {hostEvents.length > 0 && <><h2>Team for Selected Event</h2>{managedTeam.length ? managedTeam.map((member) => <article key={member.id}>
      <div><Link href={`/people/${member.user_id}`}>{member.profiles?.first_name || member.profiles?.username || "Team member"}</Link><small>{member.role_title} · {member.status} · {member.can_check_in ? "Check-in access" : "Standard access"}</small></div>
      <strong>{member.compensation_type === "percentage" ? `${member.compensation_percent}%` : money(member.fixed_amount_minor || 0, member.currency)}<small>{money(member.earnedMinor, member.currency)} funded</small></strong>
      {member.status !== "revoked" && <button className="dashboard-staff-remove" type="button" onClick={() => void remove(member.id)}>Remove</button>}
    </article>) : <p>No team members for this event yet.</p>}</>}
  </section>;
}
