"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";

type HostEvent = { id: string; title: string };
type Assignment = {
  event_id: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  events: { slug: string; title: string; starts_at: string | null; city: string | null } | null;
};
type TeamMember = {
  user_id: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  profiles: { first_name: string | null; username: string | null } | null;
};

export function CheckInTeamPanel({ hostEvents, activeEventId }: { hostEvents: HostEvent[]; activeEventId?: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [eventId, setEventId] = useState(activeEventId || hostEvents[0]?.id || "");
  const [username, setUsername] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { if (activeEventId) setEventId(activeEventId); }, [activeEventId]);

  const loadAssignments = useCallback(async () => {
    const response = await fetch("/api/event-staff");
    if (!response.ok) return;
    const data = await response.json() as { assignments?: Assignment[] };
    setAssignments(data.assignments || []);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/event-staff").then(async (response) => response.ok ? response.json() : null).then((data: { assignments?: Assignment[] } | null) => {
      if (active && data) setAssignments(data.assignments || []);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!eventId) return;
    let active = true;
    void fetch(`/api/event-staff?eventId=${encodeURIComponent(eventId)}`).then(async (response) => response.ok ? response.json() : null).then((data: { team?: TeamMember[] } | null) => {
      if (active && data) setTeam(data.team || []);
    });
    return () => { active = false; };
  }, [eventId, notice]);

  async function respond(eventIdToUpdate: string, status: "accepted" | "declined") {
    const response = await fetch("/api/event-staff", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: eventIdToUpdate, status }) });
    if (response.ok) await loadAssignments();
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const response = await fetch("/api/event-staff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, username }) });
    const result = await response.json() as { error?: string };
    setNotice(response.ok ? "Check-in invitation sent." : result.error || "Invitation failed.");
    if (response.ok) setUsername("");
  }

  async function revoke(userId: string) {
    const response = await fetch("/api/event-staff", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, userId }) });
    setNotice(response.ok ? "Check-in access removed." : "Access could not be removed.");
  }

  return <section className="dashboard-cohosting dashboard-checkin-team">
    <h2>Your Check-in Assignments</h2>
    {assignments.filter((row) => row.status !== "revoked").length ? assignments.filter((row) => row.status !== "revoked").map((row) => <article key={row.event_id}>
      <div><strong>{row.events?.title || "Event"}</strong><small>{row.status === "accepted" ? "Check-in access active" : `Invitation ${row.status}`}</small></div>
      {row.status === "pending" ? <div className="dashboard-cohost-actions"><button type="button" onClick={() => void respond(row.event_id, "accepted")}>Accept</button><button type="button" onClick={() => void respond(row.event_id, "declined")}>Decline</button></div> : row.status === "accepted" && row.events ? <Link className="dashboard-staff-scanner-link" href={`/dashboard/events/${row.events.slug}/check-in`}>Open Scanner</Link> : null}
    </article>) : <p>No check-in invitations yet.</p>}

    <h2>Invite Check-in Staff</h2>
    <p className="dashboard-role-description">Check-in staff can scan tickets for the selected event. They cannot edit the event or view revenue.</p>
    <form onSubmit={(event) => void invite(event)}>
      {!activeEventId && <label>Event<select value={eventId} onChange={(event) => setEventId(event.target.value)} required>{hostEvents.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>}
      <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="@username" required /></label>
      <button type="submit" disabled={!hostEvents.length}>Send Invitation</button>
      {notice && <p role="status">{notice}</p>}
    </form>

    {hostEvents.length > 0 && <><h2>Check-in Team</h2>{team.filter((person) => person.status !== "revoked").length ? team.filter((person) => person.status !== "revoked").map((person) => <article key={person.user_id}><div><Link href={`/people/${person.user_id}`}>{person.profiles?.first_name || person.profiles?.username || "Team member"}</Link><small>{person.status}</small></div><button className="dashboard-staff-remove" type="button" onClick={() => void revoke(person.user_id)}>Remove</button></article>) : <p>No check-in staff for this event yet.</p>}</>}
  </section>;
}
