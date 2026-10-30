"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { useSavedEvents } from "@/components/events/SavedEventsProvider";
import { ProfileInterestIcon } from "./ProfileInterestIcon";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { useAuthGate } from "@/components/auth/AuthGateProvider";

type ProfileEvent = {
  title: string;
  date: string;
  location: string;
  image: string;
  href: string;
  editHref?: string;
  ticket: string;
  going: string;
  portraits: readonly number[];
};

type PointsAccount = { balance: number; lifetime_earned: number; level: number; nextLevelCost: number; rank?: number };

const upcomingEvents: readonly ProfileEvent[] = [
  { title: "Jungle Experience", date: "Sat, Sep 28 · 8:00 PM", location: "Baan Tai, Koh Phangan", image: "/events/jungle-experience.jpg", href: "/events/jungle-experience", ticket: "2 Tickets", going: "You + 3 friends are going", portraits: [0, 1, 2, 3] },
  { title: "Sunset Breathwork", date: "Sun, Sep 29 · 5:30 PM", location: "Srithanu, Koh Phangan", image: "/events/beach-gathering.jpg", href: "/events/sunset-breathwork", ticket: "Free Event", going: "You’re going", portraits: [1, 2, 3, 0] },
  { title: "Island Vibes", date: "Tue, Oct 1 · 6:00 PM", location: "Haad Rin, Koh Phangan", image: "/events/gallery-dancefloor.jpg", href: "/events/moonlight-beach", ticket: "1 Ticket", going: "You + 5 friends are going", portraits: [2, 3, 0, 1] },
];

const mockHostedEvents = [upcomingEvents[2]];

const interestOptions = [
  { label: "Techno", image: "/events/gallery-dancefloor.jpg" },
  { label: "Yoga", image: "/hosts/yoga-retreat.jpg" },
  { label: "Nature", image: "/events/gallery-sunset.jpg" },
  { label: "Food", image: "/events/gallery-friends.jpg" },
  { label: "Travel", image: "/events/koh-phangan-map.png" },
  { label: "Music", image: "/events/gallery-dancefloor.jpg" },
  { label: "Nightlife", image: "/events/gallery-dancefloor.jpg" },
  { label: "Festival", image: "/events/gallery-dancefloor.jpg" },
  { label: "Party", image: "/events/gallery-dancefloor.jpg" },
  { label: "Wellness", image: "/hosts/yoga-retreat.jpg" },
  { label: "Fitness", image: "/hosts/yoga-retreat.jpg" },
  { label: "Sports", image: "/hosts/yoga-retreat.jpg" },
  { label: "Workshop", image: "/events/gallery-friends.jpg" },
  { label: "Education", image: "/events/gallery-friends.jpg" },
  { label: "Networking", image: "/events/gallery-friends.jpg" },
  { label: "Tech", image: "/events/gallery-friends.jpg" },
  { label: "Culture", image: "/events/gallery-friends.jpg" },
  { label: "Charity", image: "/events/gallery-friends.jpg" },
  { label: "Family", image: "/events/gallery-friends.jpg" },
  { label: "Retreat", image: "/hosts/yoga-retreat.jpg" },
  { label: "Meetup", image: "/events/gallery-friends.jpg" },
  { label: "Spiritual", image: "/hosts/yoga-retreat.jpg" },
  { label: "Adventure", image: "/events/palm-gathering.jpg" },
  { label: "Community", image: "/events/gallery-friends.jpg" },
  { label: "Art", image: "/events/gallery-stage.jpg" },
  { label: "Business", image: "/events/gallery-stage.jpg" },
  { label: "Web3", image: "/events/gallery-dancefloor.jpg" },
  { label: "Health", image: "/hosts/yoga-retreat.jpg" },
  { label: "Mindset", image: "/events/gallery-sunset.jpg" },
  { label: "People", image: "/events/gallery-friends.jpg" },
] as const;

function ProfileGlyph({ name }: { name: "gear" | "menu" | "edit" | "qr" | "bookmark" }) {
  const paths = {
    gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    edit: <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z" /><path d="m13.5 7 3.5 3.5" /></>,
    qr: <><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-4v-2" /></>,
    bookmark: <path d="M6 3h12v18l-6-4-6 4V3Z" />,
  }[name];
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>;
}

function ProfileEventRow({ event }: { event: ProfileEvent }) {
  return <Link href={event.editHref || event.href} className="own-profile-event">
    <span className="own-profile-event-photo"><Image src={event.image} alt="" fill sizes="145px" className="object-cover" unoptimized={event.image.startsWith("http")} /></span>
    <span className="own-profile-event-copy">
      <small>{event.date}</small>
      <strong>{event.title}</strong>
      <span><DiscoverIcon name="pin" />{event.location}</span>
      <span className="own-profile-event-going">{event.portraits.length > 0 && <AvatarStack people={event.portraits.map((portrait, index) => ({ id: `${event.title}-${index}`, name: ["Maya", "Lena", "Sophie", "Nina"][index], portrait }))} size={21} />}<em>{event.going}</em></span>
    </span>
    <span className="own-profile-event-ticket">{event.editHref ? <ProfileGlyph name="edit" /> : event.ticket === "Saved" ? <ProfileGlyph name="bookmark" /> : event.ticket.includes("Ticket") ? <ProfileGlyph name="qr" /> : null}<b>{event.editHref ? "Edit" : event.ticket}</b></span>
    <DiscoverIcon name="chevron" className="own-profile-event-chevron" />
  </Link>;
}

export function OwnProfileScreen() {
  const router = useRouter();
  const { requireAuth } = useAuthGate();
  const { savedIds } = useSavedEvents();
  const [interests, setInterests] = useState<string[]>(hasSupabaseConfig ? [] : interestOptions.slice(0, 5).map((interest) => interest.label));
  const [about, setAbout] = useState(hasSupabaseConfig ? "" : "Exploring the world through music, nature and meaningful connections. Always down for a good event. Let’s meet out there! 🌴☀️");
  const [profilePhoto, setProfilePhoto] = useState(hasSupabaseConfig ? "" : "/hosts/lukas-avatar.jpg");
  const [profileName, setProfileName] = useState(hasSupabaseConfig ? "My Profile" : "Chris Mann");
  const [profileUsername, setProfileUsername] = useState(hasSupabaseConfig ? "" : "chrismann");
  const [profileCity, setProfileCity] = useState(hasSupabaseConfig ? "" : "Koh Phangan, Thailand");
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationDraft, setLocationDraft] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<Record<"Upcoming" | "Past" | "Hosting" | "Co-Hosting", ProfileEvent[]>>({ Upcoming: [], Past: [], Hosting: [], "Co-Hosting": [] });
  const [notice, setNotice] = useState("");
  const [eventDraft, setEventDraft] = useState<{ id?: string; title: string; step: number } | null>(null);
  const [localMembership, setLocalMembership] = useState<{ status: string; locality: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [savedEvents, setSavedEvents] = useState<ProfileEvent[]>(hasSupabaseConfig ? [] : [...upcomingEvents.slice(0, 2)]);
  const [pointsAccount, setPointsAccount] = useState<PointsAccount>(hasSupabaseConfig ? { balance: 0, lifetime_earned: 0, level: 0, nextLevelCost: 100 } : { balance: 460, lifetime_earned: 760, level: 2, nextLevelCost: 300, rank: 12 });
  const [socialCounts, setSocialCounts] = useState({ followers: 0, following: 0 });
  const [levelBusy, setLevelBusy] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    let active = true;
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) { if (active) void requireAuth({ action: "Log in or create an account to view your profile.", next: "/profile" }); return; }
      setCurrentUserId(user.id);
      void fetch("/api/points", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((value) => { if (active && value?.account) setPointsAccount(value.account); });
      void fetch("/api/follows", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((value: { followers?: string[]; following?: string[] } | null) => { if (active && value) setSocialCounts({ followers: value.followers?.length || 0, following: value.following?.length || 0 }); });
      void supabase.from("admin_users").select("user_id").eq("user_id", user.id).eq("active", true).maybeSingle().then(({ data }) => { if (active) setIsAdmin(Boolean(data)); });
      window.localStorage.setItem("attnd:user-id", user.id);
      const profileRequest = supabase.from("profiles").select("first_name,username,avatar_url,city,interests,bio").eq("id", user.id).maybeSingle();
      const eventsRequest = Promise.all([
        supabase.from("events").select("id,slug,title,starts_at,city,cover_url,status").eq("host_id", user.id).order("starts_at", { ascending: false }),
        supabase.from("tickets").select("event_id,status").eq("owner_id", user.id).eq("status", "valid"),
        supabase.from("event_cohosts").select("events(id,slug,title,starts_at,city,cover_url,status)").eq("user_id", user.id).eq("status", "accepted"),
      ]);
      fetch("/api/local-membership", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((value) => { if (active) setLocalMembership(value?.membership || null); });
      const { data: profile } = await profileRequest;
      if (!active) return;
      setProfileName(profile?.first_name || user.email?.split("@")[0] || "My Profile");
      setProfileUsername(profile?.username || "");
      setProfileCity(profile?.city || "");
      setProfilePhoto(profile?.avatar_url || "");
      setAbout(profile?.bio || "");
      setInterests(profile?.interests || []);
      const [{ data: hosted }, { data: tickets }, { data: cohostRows }] = await eventsRequest;
      if (!active) return;
      const eventIds = [...new Set((tickets || []).map((ticket) => ticket.event_id))];
      const { data: attending } = eventIds.length
        ? await supabase.from("events").select("id,slug,title,starts_at,city,cover_url,status").in("id", eventIds)
        : { data: [] };
      if (!active) return;
      type EventRow = { id: string; slug: string; title: string; starts_at: string | null; city: string | null; cover_url: string | null; status: string };
      const toProfileEvent = (event: EventRow, ticket: string): ProfileEvent => ({
        title: event.title,
        date: event.starts_at ? new Date(event.starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : event.status.toUpperCase(),
        location: event.city || "Location to be announced",
        image: event.cover_url || "/events/palm-gathering.jpg",
        href: event.status === "draft" ? `/create?id=${event.id}` : `/events/${event.slug}`,
        editHref: ticket === "Hosting" || event.status === "draft" ? `/create?id=${event.id}` : undefined,
        ticket,
        going: ticket === "Hosting" ? "Hosted by you" : ticket === "Co-Host" ? "Co-hosted by you" : "You’re going",
        portraits: [],
      });
      const now = Date.now();
      const ticketCounts = new Map<string, number>();
      for (const ticket of tickets || []) ticketCounts.set(ticket.event_id, (ticketCounts.get(ticket.event_id) || 0) + 1);
      setLiveEvents({
        Upcoming: (attending || []).filter((event) => !event.starts_at || new Date(event.starts_at).getTime() >= now).map((event) => toProfileEvent(event, `${ticketCounts.get(event.id) || 1} Tickets`)),
        Past: (attending || []).filter((event) => event.starts_at && new Date(event.starts_at).getTime() < now).map((event) => toProfileEvent(event, `${ticketCounts.get(event.id) || 1} Tickets`)),
        Hosting: (hosted || []).map((event) => toProfileEvent(event, event.status === "draft" ? "Draft" : "Hosting")),
        "Co-Hosting": (cohostRows || []).flatMap((row) => row.events ? [toProfileEvent(row.events as unknown as EventRow, "Co-Host")] : []),
      });
    };
    void load();
    return () => { active = false; };
  }, [requireAuth]);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    if (savedIds.size === 0) {
      const frame = window.requestAnimationFrame(() => setSavedEvents([]));
      return () => window.cancelAnimationFrame(frame);
    }
    let active = true;
    void createClient().from("events").select("slug,title,starts_at,city,venue_name,cover_url,status").in("slug", [...savedIds]).eq("status", "published").order("starts_at", { ascending: true }).then(({ data }) => {
      if (!active) return;
      setSavedEvents((data || []).map((event) => ({
        title: event.title,
        date: event.starts_at ? new Date(event.starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "DATE TO BE ANNOUNCED",
        location: [event.venue_name, event.city].filter(Boolean).join(", ") || "Location to be announced",
        image: event.cover_url || "/events/palm-gathering.jpg",
        href: `/events/${event.slug}`,
        ticket: "Saved",
        going: "Saved by you",
        portraits: [],
      })));
    });
    return () => { active = false; };
  }, [savedIds]);

  const openNotifications = async () => {
    if (await requireAuth({ action: "Log in or create an account to see your notifications.", next: "/notifications" })) router.push("/notifications");
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const draft = JSON.parse(window.localStorage.getItem("attnd:event-draft") ?? "null") as { id?: string; title?: string; step?: number } | null;
        if (draft) setEventDraft({ id: draft.id, title: draft.title?.trim() || "Untitled Event", step: draft.step ?? 1 });
      } catch { setEventDraft(null); }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const unlockNextLevel = async () => {
    if (levelBusy || pointsAccount.balance < pointsAccount.nextLevelCost) return;
    setLevelBusy(true);
    try {
      const response = await fetch("/api/points", { method: "POST" });
      const result = await response.json() as { account?: PointsAccount; error?: string };
      if (!response.ok || !result.account) throw new Error(result.error || "Level could not be unlocked");
      setPointsAccount((current) => ({ ...current, ...result.account! }));
      showNotice(`Level ${result.account.level} unlocked`);
    } catch (error) { showNotice(error instanceof Error ? error.message : "Level could not be unlocked"); }
    finally { setLevelBusy(false); }
  };

  const saveProfileLocation = async () => {
    const city = locationDraft.trim();
    if (!city) return;
    if (currentUserId) {
      const { error } = await createClient().from("profiles").update({ city, updated_at: new Date().toISOString() }).eq("id", currentUserId);
      if (error) { showNotice(error.message); return; }
    }
    setProfileCity(city); setLocationOpen(false); showNotice("Current location updated");
  };

  const changeProfilePhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!currentUserId) { setProfilePhoto(URL.createObjectURL(file)); return; }
    const supabase = createClient();
    let uploadFile: Blob = file;
    let extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", .82));
      bitmap.close();
      if (compressed) { uploadFile = compressed; extension = "webp"; }
    } catch { /* Keep the original file if this device cannot resize it. */ }
    const path = `${currentUserId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("avatars").upload(path, uploadFile, { contentType: uploadFile.type || file.type });
    if (error) { showNotice(error.message); return; }
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: url, updated_at: new Date().toISOString() }).eq("id", currentUserId);
    if (updateError) { showNotice(updateError.message); return; }
    setProfilePhoto(url);
  };

  const draftProfileEvent: ProfileEvent | null = eventDraft ? { title: eventDraft.title, date: `DRAFT · STEP ${eventDraft.step} OF 9`, location: "Continue editing your event", image: "/events/gallery-sunset.jpg", href: eventDraft.id ? `/create?id=${eventDraft.id}` : "/create", editHref: eventDraft.id ? `/create?id=${eventDraft.id}` : "/create", ticket: "Draft", going: "Saved automatically", portraits: [] } : null;
  const createdEvents = hasSupabaseConfig
    ? (draftProfileEvent ? [draftProfileEvent, ...liveEvents.Hosting] : liveEvents.Hosting)
    : (draftProfileEvent ? [draftProfileEvent, ...mockHostedEvents] : mockHostedEvents);

  return <div className="own-profile-screen">
    <header className="own-profile-topbar">
      <span className="own-profile-topbar-spacer" aria-hidden="true" />
      <div>
        <Link href="/profile/settings" aria-label="Profile settings"><ProfileGlyph name="gear" /></Link>
        <button type="button" onClick={() => void openNotifications()} aria-label="Notifications" className="page-notification-link"><DiscoverIcon name="bell" /></button>
      </div>
    </header>

    <section className="own-profile-identity">
      <div className="own-profile-intro-row">
        <div className="own-profile-avatar">{profilePhoto && <Image src={profilePhoto} alt={profileName} fill priority sizes="82px" className="object-cover" unoptimized={profilePhoto.startsWith("blob:") || (profilePhoto.startsWith("http") && !profilePhoto.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`))} />}<label><ProfileGlyph name="edit" /><input type="file" accept="image/*" aria-label="Change profile photo" onChange={(event) => { void changeProfilePhoto(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label></div>
        <div className="own-profile-name-block"><h1>{profileName}</h1><p>{profileUsername ? `@${profileUsername}` : ""}</p><div className="own-profile-status-inline"><button type="button" disabled={levelBusy} onClick={() => pointsAccount.balance >= pointsAccount.nextLevelCost ? void unlockNextLevel() : showNotice(`${Math.max(0, pointsAccount.nextLevelCost - pointsAccount.balance).toLocaleString()} points until Level ${pointsAccount.level + 1}`)}><strong>Level {pointsAccount.level}</strong>{pointsAccount.balance >= pointsAccount.nextLevelCost && <small>Unlock next</small>}</button><span><strong>{pointsAccount.balance.toLocaleString()}</strong><small>Points</small></span></div><div className="own-profile-social-inline"><span><strong>{socialCounts.followers.toLocaleString()}</strong> Followers</span><i /><span><strong>{socialCounts.following.toLocaleString()}</strong> Following</span></div><Link className="own-profile-preview" href="/profile/preview">Preview profile <DiscoverIcon name="chevron" /></Link>{localMembership?.status === "verified" && <span className="own-profile-local-badge">✓ Local · {localMembership.locality}</span>}</div>
      </div>
      <div className="own-profile-description">{about && <p>{about}</p>}{!hasSupabaseConfig && <p>Events · Travel · Good People · Better Days</p>}<button type="button" className="own-profile-current-location" onClick={() => { setLocationDraft(profileCity || "Koh Phangan"); setLocationOpen(true); }}><DiscoverIcon name="pin" /><span>Living in</span><strong>{profileCity || "Koh Phangan"}</strong><DiscoverIcon name="chevron" /></button></div>
      <section className="own-profile-stats" aria-label="Profile statistics">
        <Link href="/tickets"><strong>{hasSupabaseConfig ? liveEvents.Past.length : 27}</strong><span>Attended</span></Link>
        <Link href="/dashboard?tab=events"><strong>{hasSupabaseConfig ? liveEvents.Hosting.length : 8}</strong><span>Hosted</span></Link>
        <Link href="/profile/saved"><strong>{hasSupabaseConfig ? savedIds.size : 12}</strong><span>Saved</span></Link>
      </section>
      <div className="own-profile-header-interests">{interests.slice(0, 5).map((interest) => <span key={interest}><ProfileInterestIcon label={interest} />{interest}</span>)}</div>
    </section>

    <section className="own-profile-events" aria-label="My events">
      <header className="own-profile-events-heading"><h2>My Events</h2></header>
      <div className="own-profile-events-grid">{createdEvents.slice(0, 3).map((event) => <ProfileEventRow key={`${event.title}-${event.date}`} event={event} />)}</div>
      {createdEvents.length === 0 && <div className="own-profile-events-empty"><DiscoverIcon name="calendar" /><strong>Your first event starts here.</strong><p>Create it now and manage everything from one place.</p><Link href="/create">Create Event</Link></div>}
      <Link href="/dashboard?tab=events" className="own-profile-view-all"><DiscoverIcon name="calendar" /><span>Manage all events</span><DiscoverIcon name="chevron" /></Link>
    </section>

    <section className="own-profile-events own-profile-saved-events" aria-label="Saved events">
      <header className="own-profile-events-heading"><h2>Saved Events</h2></header>
      <div className="own-profile-events-grid">{savedEvents.slice(0, 3).map((event) => <ProfileEventRow key={`saved-${event.href}`} event={event} />)}</div>
      {savedEvents.length === 0 && <div className="own-profile-saved-empty"><DiscoverIcon name="heart" /><span>Events you save will appear here.</span></div>}
      <Link href="/profile/saved" className="own-profile-view-all"><DiscoverIcon name="heart" /><span>View all saved events</span><DiscoverIcon name="chevron" /></Link>
    </section>

    <section className="own-profile-leaderboard"><Link href="/leaderboard"><span><DiscoverIcon name="trophy" /></span><div><small>COMMUNITY</small><strong>Leaderboard</strong><p>See every member’s points and level.</p></div><DiscoverIcon name="chevron" /></Link></section>

    <section className="own-profile-tools" aria-label="Attnd tools"><div className="own-profile-tools-menu">{isAdmin && <Link href="/admin"><span><DiscoverIcon name="shield" /></span><div><strong>Attnd Admin</strong><small>Operations and platform KPIs</small></div><DiscoverIcon name="chevron" /></Link>}<Link href="/dashboard"><span><DiscoverIcon name="calendar" /></span><div><strong>Hosting</strong><small>Create and manage your events</small></div><DiscoverIcon name="chevron" /></Link><Link href="/affiliate"><span><DiscoverIcon name="users" /></span><div><strong>Affiliate</strong><small>Links, bookings and commission</small></div><DiscoverIcon name="chevron" /></Link></div></section>
    {locationOpen && <div className="own-profile-location-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-location-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setLocationOpen(false); }}><form onSubmit={(event) => { event.preventDefault(); void saveProfileLocation(); }}><header><div><small>CURRENT LOCATION</small><h2 id="profile-location-title">Choose your city</h2></div><button type="button" aria-label="Close location picker" onClick={() => setLocationOpen(false)}><DiscoverIcon name="x" /></button></header><label><DiscoverIcon name="search" /><input autoFocus value={locationDraft} onChange={(event) => setLocationDraft(event.target.value)} placeholder="City or island" /></label><div className="own-profile-location-suggestions">{["Koh Phangan", "Koh Samui", "Bangkok", "Phuket"].map((city) => <button type="button" key={city} onClick={() => setLocationDraft(city)} aria-pressed={locationDraft === city}><DiscoverIcon name="pin" />{city}</button>)}</div><button type="submit" className="own-profile-location-save" disabled={!locationDraft.trim()}>Save location</button></form></div>}
    {notice && <p role="status" className="own-profile-toast">{notice}</p>}
  </div>;
}
