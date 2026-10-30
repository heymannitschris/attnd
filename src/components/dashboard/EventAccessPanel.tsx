"use client";

import { useCallback, useEffect, useState } from "react";
import { promptDialog } from "@/lib/dialog";

type HostEvent = { id: string; title: string };
type Guest = { id: string; guest_name: string; guest_email: string | null; plus_ones: number; notes: string; status: "invited" | "arrived" | "cancelled"; profiles: { username: string | null } | null };
type Local = { id: string; user_id: string; locality: string; status: string; submitted_at: string; proof_original_name: string | null; proof_url: string | null; review_note: string; profiles: { first_name: string | null; username: string | null } | null };
type Rule = { enabled: boolean; locality: string; benefit_type: "free" | "percentage"; discount_percent: number; capacity: number | null; redeemed_count: number };

export function EventAccessPanel({ hostEvents, mode, activeEventId }: { hostEvents: HostEvent[]; mode: "guestlist" | "locals"; activeEventId?: string }) {
  const [eventId, setEventId] = useState(activeEventId || hostEvents[0]?.id || "");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [locals, setLocals] = useState<Local[]>([]);
  const [rule, setRule] = useState<Rule>({ enabled: true, locality: "", benefit_type: "percentage", discount_percent: 25, capacity: null, redeemed_count: 0 });
  const [notice, setNotice] = useState("");
  useEffect(() => { if (activeEventId) setEventId(activeEventId); }, [activeEventId]);
  const load = useCallback(async () => {
    if (!eventId) return;
    const response = await fetch(`/api/event-access?eventId=${encodeURIComponent(eventId)}`);
    const data = await response.json() as { guestlist?: Guest[]; locals?: Local[]; localRule?: Rule | null; suggestedLocality?: string };
    if (!response.ok) return setNotice((data as { error?: string }).error || "Could not load access settings");
    setGuests(data.guestlist || []); setLocals(data.locals || []);
    setRule(data.localRule || { enabled: true, locality: data.suggestedLocality || "", benefit_type: "percentage", discount_percent: 25, capacity: null, redeemed_count: 0 });
  }, [eventId]);
  // Loading follows the selected event and updates the panel after the request resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  async function submit(body: Record<string, unknown>, success: string) {
    setNotice("");
    const response = await fetch("/api/event-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, ...body }) });
    const result = await response.json() as { error?: string };
    setNotice(response.ok ? success : result.error || "Could not save");
    if (response.ok) await load();
    return response.ok;
  }
  async function reviewLocal(member: Local, status: "verified" | "rejected") {
    const reviewNote = status === "rejected" ? await promptDialog("Optional note for the member", { defaultValue: "Please upload a current proof of residence." }) || "" : "";
    setNotice("");
    const response = await fetch("/api/event-access", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, membershipId: member.id, membershipStatus: status, reviewNote }) });
    const result = await response.json() as { error?: string };
    setNotice(response.ok ? status === "verified" ? "Local Membership approved." : "Application returned to the member." : result.error || "Could not update application");
    if (response.ok) await load();
  }
  if (!hostEvents.length) return <section className="dashboard-panel"><h2>{mode === "guestlist" ? "Guestlist" : "Local Membership"}</h2><p>Create an event first.</p></section>;
  return <section className="dashboard-cohosting dashboard-team-management dashboard-access-panel">
    <h2>{mode === "guestlist" ? "Guestlist" : "Local Membership"}</h2>
    {!activeEventId && <label>Event<select value={eventId} onChange={(event) => setEventId(event.target.value)}>{hostEvents.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
    {mode === "guestlist" ? <>
      <p className="dashboard-access-intro">Add named guests and plus ones, then mark arrivals at the door.</p>
      <form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const ok = await submit({ action: "guest", name: form.get("name"), username: form.get("username"), email: form.get("email"), plusOnes: Number(form.get("plusOnes")), notes: form.get("notes") }, "Guest added."); if (ok) event.currentTarget.reset(); }}>
        <label>Guest name<input name="name" placeholder="Full name" required /></label><label>Attnd username (optional)<input name="username" placeholder="@username" /></label><label>Email (optional)<input name="email" type="email" placeholder="guest@example.com" /></label><label>Plus ones<input name="plusOnes" type="number" min="0" max="10" defaultValue="0" /></label><label>Host note<input name="notes" placeholder="VIP, artist list, table…" /></label><button type="submit">Add to Guestlist</button>
      </form>
      <h2>{guests.filter((guest) => guest.status !== "cancelled").length} Guests</h2>
      {guests.filter((guest) => guest.status !== "cancelled").map((guest) => <article key={guest.id}><div><strong>{guest.guest_name}{guest.plus_ones ? ` +${guest.plus_ones}` : ""}</strong><small>{guest.profiles?.username ? `@${guest.profiles.username}` : guest.guest_email || guest.notes || "Guestlist"}</small></div><div className="dashboard-cohost-actions"><button type="button" onClick={async () => { await fetch("/api/event-access", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, guestId: guest.id, status: guest.status === "arrived" ? "invited" : "arrived" }) }); await load(); }}>{guest.status === "arrived" ? "Undo arrival" : "Mark arrived"}</button><button type="button" onClick={async () => { await fetch(`/api/event-access?eventId=${encodeURIComponent(eventId)}&guestId=${guest.id}`, { method: "DELETE" }); await load(); }}>Remove</button></div></article>)}
    </> : <>
      <p className="dashboard-access-intro">Offer verified locals free or discounted entry. Each membership can redeem the benefit once per event.</p>
      <form onSubmit={(event) => { event.preventDefault(); void submit({ action: "rule", enabled: rule.enabled, locality: rule.locality, benefitType: rule.benefit_type, discountPercent: rule.discount_percent, capacity: rule.capacity }, "Local access saved."); }}>
        <label className="dashboard-access-switch"><input type="checkbox" checked={rule.enabled} onChange={(event) => setRule({ ...rule, enabled: event.target.checked })} />Enable local access</label><label>Local area<input value={rule.locality} onChange={(event) => setRule({ ...rule, locality: event.target.value })} placeholder="Koh Phangan" required /></label><label>Benefit<select value={rule.benefit_type} onChange={(event) => setRule({ ...rule, benefit_type: event.target.value as Rule["benefit_type"], discount_percent: event.target.value === "free" ? 100 : 25 })}><option value="percentage">Discounted entry</option><option value="free">Free entry</option></select></label>{rule.benefit_type === "percentage" && <label>Discount (%)<input type="number" min="1" max="99" value={rule.discount_percent} onChange={(event) => setRule({ ...rule, discount_percent: Number(event.target.value) })} /></label>}<label>Maximum redemptions (optional)<input type="number" min="1" value={rule.capacity || ""} onChange={(event) => setRule({ ...rule, capacity: event.target.value ? Number(event.target.value) : null })} /></label><button type="submit">Save Local Benefit</button>
      </form>
      <h2>Verify a Local</h2><form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const ok = await submit({ action: "local", username: form.get("username"), locality: rule.locality }, "Local membership verified."); if (ok) event.currentTarget.reset(); }}><label>Attnd username<input name="username" placeholder="@username" required /></label><button type="submit">Verify Membership</button></form>
      <h2>Applications <small>{locals.filter((member) => member.status === "pending").length} pending</small></h2>
      {locals.filter((member) => member.status === "pending").length === 0 && <p className="dashboard-access-empty">No pending applications for {rule.locality || "this area"}.</p>}
      {locals.filter((member) => member.status === "pending").map((member) => <article key={member.id}><div><strong>{member.profiles?.first_name || member.profiles?.username || "Member"}</strong><small>@{member.profiles?.username || "member"} · {member.locality}</small>{member.proof_url && <a href={member.proof_url} target="_blank" rel="noreferrer">View {member.proof_original_name || "residence proof"}</a>}</div><div className="dashboard-cohost-actions"><button type="button" onClick={() => void reviewLocal(member, "verified")}>Approve</button><button type="button" onClick={() => void reviewLocal(member, "rejected")}>Reject</button></div></article>)}
      <h2>{locals.filter((member) => member.status === "verified").length} Verified Locals <small>{rule.redeemed_count} redeemed</small></h2>{locals.filter((member) => member.status === "verified").map((member) => <article key={member.id}><div><strong>{member.profiles?.first_name || member.profiles?.username || "Member"}</strong><small>@{member.profiles?.username || "member"} · {member.locality}</small></div><b data-status={member.status}>{member.status}</b></article>)}
    </>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
