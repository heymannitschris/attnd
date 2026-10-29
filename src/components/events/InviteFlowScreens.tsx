"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DiscoveryEvent } from "@/types/event";
import { Avatar } from "@/components/ui/Avatar";
import { DiscoverIcon } from "./DiscoverIcon";
import { buildAffiliateEventUrl } from "@/lib/affiliate-links";
import { useAuthGate } from "@/components/auth/AuthGateProvider";

const invitePeople = [
  { id: "sophie", name: "Sophie Müller", relation: "Follows you", portrait: 1 },
  { id: "david", name: "David Kim", relation: "Follows you", portrait: 2 },
  { id: "emma", name: "Emma Schmidt", relation: "12 mutual friends", portrait: 3 },
  { id: "luca", name: "Luca Rossi", relation: "8 mutual friends", portrait: 0 },
  { id: "mia", name: "Mia Chen", relation: "Follows you", portrait: 1 },
  { id: "jonas", name: "Jonas Becker", relation: "5 mutual friends", portrait: 2 },
  { id: "lea", name: "Lea Wagner", relation: "Follows you", portrait: 3 },
  { id: "marco", name: "Marco Bianchi", relation: "3 mutual friends", portrait: 0 },
  { id: "anna", name: "Anna Fischer", relation: "Follows you", portrait: 1 },
  { id: "tim", name: "Tim Schulz", relation: "7 mutual friends", portrait: 2 },
] as const;

type InvitePerson = { id: string; name: string; relation: string; portrait: number; avatarUrl?: string };

function useInviteAccess(next: string) {
  const { requireAuth } = useAuthGate();
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let active = true;
    void requireAuth({ action: "Log in or create an account to invite friends.", next }).then((value) => { if (active) setAllowed(value); });
    return () => { active = false; };
  }, [next, requireAuth]);
  return allowed;
}

async function loadInvitePeople(): Promise<InvitePerson[] | null> {
  const response = await fetch("/api/profiles");
  if (!response.ok) return null;
  const result = await response.json() as { profiles?: Array<{ id: string; first_name: string | null; username: string | null; avatar_url: string | null; city: string | null }> };
  return result.profiles?.map((profile, index) => ({ id: profile.id, name: profile.first_name || profile.username || "Attnd member", relation: profile.city || (profile.username ? `@${profile.username}` : "Attnd member"), portrait: index % 4, avatarUrl: profile.avatar_url || undefined })) || [];
}

function InviteHeader({ title, backHref }: { title: string; backHref: string }) {
  return <header className="invite-flow-header"><Link href={backHref} aria-label="Back"><DiscoverIcon name="chevron" /></Link><h1>{title}</h1><span /></header>;
}

function getPeople(ids?: string) {
  const selected = ids?.split(",").filter(Boolean) ?? [];
  return invitePeople.filter((person) => selected.includes(person.id));
}

export function InvitePeopleScreen({ event }: { event: DiscoveryEvent }) {
  const allowed = useInviteAccess(`/events/${event.id}/invite`);
  const [segment, setSegment] = useState("Following");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<readonly InvitePerson[]>([]);
  const [followingIds, setFollowingIds] = useState<ReadonlySet<string>>(new Set());
  const [followerIds, setFollowerIds] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState(() => new Set<string>());
  const referralUrl = allowed ? buildAffiliateEventUrl("https://www.attnd.space", event.id) : "";
  const [linkCopied, setLinkCopied] = useState(false);
  useEffect(() => {
    if (!allowed) return;
    void Promise.all([loadInvitePeople(), fetch("/api/follows", { cache: "no-store" })]).then(async ([profiles, response]) => {
      if (profiles) setPeople(profiles);
      if (!response.ok) return;
      const connections = await response.json() as { following?: string[]; followers?: string[] };
      setFollowingIds(new Set(connections.following || []));
      setFollowerIds(new Set(connections.followers || []));
    });
  }, [allowed]);
  const visible = people.filter((person) => {
    const matchesSegment = segment === "Following" ? followingIds.has(person.id) : segment === "Followers" ? followerIds.has(person.id) : true;
    return matchesSegment && `${person.name} ${person.relation}`.toLowerCase().includes(query.toLowerCase());
  });
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const copyReferralLink = async () => { if (!referralUrl) return; await navigator.clipboard.writeText(referralUrl); setLinkCopied(true); window.setTimeout(() => setLinkCopied(false), 1800); };
  const shareReferralLink = async () => {
    if (!referralUrl) return;
    if (navigator.share) {
      try { await navigator.share({ title: event.title, text: `Join me at ${event.title}`, url: referralUrl }); return; }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
    }
    await copyReferralLink();
  };
  const connectionCounts = { Following: followingIds.size, Followers: followerIds.size };
  return <div className="invite-flow-screen invite-people-screen"><div className="invite-people-fixed"><InviteHeader title="Invite People" backHref={`/events/${event.id}`} /><p className="invite-flow-subtitle">Choose friends to invite to {event.title}</p><label className="invite-search"><DiscoverIcon name="search" /><input value={query} onChange={(input) => setQuery(input.target.value)} placeholder="Search people" /></label><div className="invite-segments">{["Following", "Followers", "Recent"].map((item) => <button key={item} type="button" aria-pressed={segment === item} onClick={() => setSegment(item)}>{item}{item !== "Recent" && ` (${connectionCounts[item as keyof typeof connectionCounts]})`}</button>)}</div></div><section className="invite-external-card"><div><DiscoverIcon name="share" /><p><strong>Invite outside Attnd</strong><span>Share your personal referral link anywhere.</span></p></div><label><input readOnly value={referralUrl} aria-label="Personal event referral link" onFocus={(input) => input.currentTarget.select()} /><button type="button" disabled={!referralUrl} onClick={() => void copyReferralLink()}>{linkCopied ? "Copied ✓" : "Copy"}</button></label><button type="button" className="invite-external-share" disabled={!referralUrl} onClick={() => void shareReferralLink()}><DiscoverIcon name="send" />Share with friends</button></section><section className="invite-people-list">{visible.map((person) => <button key={person.id} type="button" aria-pressed={selected.has(person.id)} onClick={() => toggle(person.id)}><Avatar name={person.name} portrait={person.portrait} avatarUrl={person.avatarUrl} size={45} /><span><strong>{person.name}</strong><small>{person.relation}</small></span><i>{selected.has(person.id) ? "✓" : ""}</i></button>)}{visible.length === 0 && <p className="invite-people-empty">No people here yet.</p>}</section><footer className="invite-flow-footer"><Link aria-disabled={!selected.size} href={selected.size ? `/events/${event.id}/invite/message?people=${[...selected].join(",")}` : "#"}>Invite {selected.size} {selected.size === 1 ? "Person" : "People"}</Link></footer></div>;
}

export function InviteMessageScreen({ event, peopleIds }: { event: DiscoveryEvent; peopleIds?: string }) {
  const allowed = useInviteAccess(`/events/${event.id}/invite/message${peopleIds ? `?people=${encodeURIComponent(peopleIds)}` : ""}`);
  const router = useRouter();
  const initialPeople = useMemo(() => getPeople(peopleIds), [peopleIds]);
  const [selected, setSelected] = useState<InvitePerson[]>(initialPeople);
  const [message, setMessage] = useState(`Hey! 👋\nI thought you might like this event!\nLet’s go to ${event.title} together.\nIt’s going to be great! 🌅`);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!allowed || !peopleIds) return; void loadInvitePeople().then((profiles) => { if (profiles) setSelected(profiles.filter((profile) => peopleIds.split(",").includes(profile.id))); }); }, [allowed, peopleIds]);
  const send = async () => { setSending(true); setError(""); const response = await fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: event.id, recipientIds: selected.map((person) => person.id), message }) }); const result = await response.json() as { error?: string }; setSending(false); if (!response.ok) { setError(result.error || "Invites could not be sent"); return; } router.push(`/events/${event.id}/invite/success?people=${selected.map((person) => person.id).join(",")}`); };
  return <div className="invite-flow-screen invite-message-screen"><InviteHeader title="Add a Message" backHref={`/events/${event.id}/invite`} /><p className="invite-flow-subtitle">Let them know why you’re inviting them.</p><label className="invite-message"><textarea value={message} maxLength={300} onChange={(input) => setMessage(input.target.value)} /><small>{message.length}/300</small></label><h2>Invite Preview ({selected.length})</h2><section className="invite-preview-list">{selected.map((person) => <article key={person.id}><Avatar name={person.name} portrait={person.portrait} size={42} /><strong>{person.name}</strong><button type="button" aria-label={`Remove ${person.name}`} onClick={() => setSelected(selected.filter((item) => item.id !== person.id))}><DiscoverIcon name="x" /></button></article>)}</section>{error && <p role="alert" className="transfer-notice">{error}</p>}<footer className="invite-flow-footer"><button type="button" disabled={sending || !selected.length} onClick={() => void send()}>{sending ? "Sending…" : "Send Invites"}</button></footer></div>;
}

export function InviteSuccessScreen({ event, peopleIds }: { event: DiscoveryEvent; peopleIds?: string }) {
  const allowed = useInviteAccess(`/events/${event.id}/invite/success${peopleIds ? `?people=${encodeURIComponent(peopleIds)}` : ""}`);
  const [people, setPeople] = useState<InvitePerson[]>(getPeople(peopleIds));
  useEffect(() => { if (!allowed || !peopleIds) return; void loadInvitePeople().then((profiles) => { if (profiles) setPeople(profiles.filter((profile) => peopleIds.split(",").includes(profile.id))); }); }, [allowed, peopleIds]);
  const [copied, setCopied] = useState(false);
  const copyLink = async () => { await navigator.clipboard.writeText(buildAffiliateEventUrl(window.location.origin, event.id)); setCopied(true); };
  return <div className="invite-flow-screen invite-success-screen"><section className="invite-success-intro"><span><DiscoverIcon name="send" /></span><h1>Invites Sent!</h1><p>{people.length} people have been invited to<br />{event.title}.</p></section><section className="invite-sent-list">{people.map((person) => <article key={person.id}><Avatar name={person.name} portrait={person.portrait} size={43} /><p><strong>{person.name}</strong><span>✓ Invite sent</span></p></article>)}</section><button type="button" className="invite-share-link" onClick={copyLink}><DiscoverIcon name={copied ? "check" : "share"} />{copied ? "Event Link Copied" : "Share Event Link"}</button><section className="invite-earn"><DiscoverIcon name="gift" /><p><strong>Earn with Invites</strong><span>When your friends buy a ticket, you’ll automatically receive affiliate commission. No extra steps needed!</span><Link href="/affiliate">Learn More <DiscoverIcon name="arrow" /></Link></p></section><div className="invite-success-actions"><Link href={`/events/${event.id}/invites`}>Track Invites</Link><Link href={`/events/${event.id}`}>Done</Link></div></div>;
}

export function EventInvitesScreen({ event }: { event: DiscoveryEvent }) {
  const allowed = useInviteAccess(`/events/${event.id}/invites`);
  const [tab, setTab] = useState("Sent");
  const [reminded, setReminded] = useState(false);
  type TrackedInvite = { id: string; status: string; detail: string; time: string; person: InvitePerson };
  const [activities, setActivities] = useState<TrackedInvite[] | null>(null);
  useEffect(() => { if (allowed) void fetch(`/api/invites?eventId=${encodeURIComponent(event.id)}`).then(async (response) => response.ok ? response.json() : null).then((result: { invites?: Array<{ id: string; status: string; created_at: string; invitee_email: string | null; profiles: { first_name: string | null; username: string | null } | null }> } | null) => { if (!result?.invites) return; setActivities(result.invites.map((invite, index) => ({ id: invite.id, status: invite.status === "joined" ? "Joined" : invite.status === "seen" ? "Seen" : "Pending", detail: invite.status === "joined" ? "Joined through your invite" : invite.status === "seen" ? "Viewed the event" : "Invitation sent", time: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(invite.created_at)), person: { id: invite.id, name: invite.profiles?.first_name || invite.profiles?.username || invite.invitee_email || "Invited guest", relation: invite.profiles?.username ? `@${invite.profiles.username}` : invite.invitee_email || "Invited guest", portrait: index % 4 } }))); }); }, [allowed, event.id]);
  const tracked = activities ?? [];
  const visible = tracked.filter((activity) => tab === "Sent" || (tab === "Joined" ? activity.status === "Joined" : activity.status === "Pending" || activity.status === "Seen"));
  const remind = async () => { const response = await fetch("/api/invites", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: event.id }) }); if (response.ok) setReminded(true); };
  const counts = { Sent: tracked.length, Joined: tracked.filter((item) => item.status === "Joined").length, Pending: tracked.filter((item) => item.status !== "Joined").length };
  return <div className="invite-flow-screen invite-tracking-screen"><InviteHeader title="Invites" backHref={`/events/${event.id}`} /><div className="invite-track-tabs">{(["Sent", "Joined", "Pending"] as const).map((item) => <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)}>{item} ({counts[item]})</button>)}</div><section className="invite-activity-list">{visible.map((activity) => <article key={activity.id}><Avatar name={activity.person.name} portrait={activity.person.portrait} size={46} /><p><strong>{activity.person.name}</strong><span>{activity.detail}</span></p><div><b data-status={activity.status}>{activity.status}</b><time>{activity.time}</time></div><DiscoverIcon name="chevron" /></article>)}</section><section className="invite-reminder"><DiscoverIcon name="info" /><p><strong>Tip: Remind your friends</strong><span>Send a friendly reminder to increase your chances of them joining.</span><button type="button" onClick={() => void remind()}><DiscoverIcon name={reminded ? "check" : "send"} />{reminded ? "Reminder Sent" : "Send Reminder"}</button></p></section></div>;
}
