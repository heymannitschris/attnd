import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttendeeProfileScreen } from "@/components/profile/AttendeeProfileScreen";
import { HostProfileScreen } from "@/components/profile/HostProfileScreen";
import { mockAttendees } from "@/lib/mock-attendees";
import { followerPeople, followingPeople } from "@/lib/mock-social";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { eventTimeZone } from "@/lib/event-time";
import type { HostEvent, HostProfile } from "@/types/host";

// Real profiles read the viewer session (cookies), so this route must render per request.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const socialPeople = [...followerPeople, ...followingPeople].filter((person, index, all) => all.findIndex((item) => item.id === person.id) === index);

export function generateStaticParams() { return [...mockAttendees, ...socialPeople].map(({ id }) => ({ id })); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const person = mockAttendees.find((item) => item.id === id);
  const socialPerson = socialPeople.find((item) => item.id === id);
  return { title: person || socialPerson ? `${(person || socialPerson)!.name} | Attnd` : "Profile | Attnd" };
}

export default async function PersonPage({ params }: Props) {
  const { id: rawId } = await params;
  const person = mockAttendees.find((item) => item.id === rawId);
  if (person) return <AttendeeProfileScreen person={person} />;
  const socialPerson = socialPeople.find((item) => item.id === rawId);
  if (socialPerson) return <AttendeeProfileScreen person={{ id: socialPerson.id, name: socialPerson.name, location: socialPerson.location, portrait: socialPerson.portrait, group: socialPerson.nearby ? "local" : "traveler", following: socialPerson.following }} />;
  if (!hasSupabaseConfig) notFound();
  const admin = createAdminClient();
  // Profiles are linked by id or by username (e.g. /people/heymannitschris).
  let id = rawId;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(rawId)) {
    const { data: byUsername } = await admin.from("profiles").select("id").eq("username", decodeURIComponent(rawId).replace(/^@/, "")).maybeSingle();
    if (!byUsername) notFound();
    id = byUsername.id;
  }
  const supabase = await createClient();
  const { data: { user: viewer } } = await supabase.auth.getUser();
  const [{ data: user }, { data: hostedRows }, { data: cohostRows }, { data: localMembership }, followerCount, followingCount, { data: points }] = await Promise.all([
    admin.from("profiles").select("first_name,username,avatar_url,city,bio,interests,notification_preferences").eq("id", id).maybeSingle(),
    admin.from("events").select("id,slug,title,cover_url,city,starts_at,status").eq("host_id", id).eq("status", "published").eq("unlisted", false).order("starts_at", { ascending: true }),
    admin.from("event_cohosts").select("events(id,slug,title,cover_url,city,starts_at,status,unlisted)").eq("user_id", id).eq("status", "accepted"),
    admin.from("local_memberships").select("locality").eq("user_id", id).eq("status", "verified").maybeSingle(),
    admin.from("profile_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", id),
    admin.from("profile_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", id),
    admin.from("user_points_accounts").select("level,lifetime_earned").eq("user_id", id).maybeSingle(),
  ]);
  if (!user) notFound();
  const preferences = (user.notification_preferences || {}) as Record<string, unknown>;
  const visibility = String(preferences.profile_visibility || "everyone");
  if (viewer?.id !== id && visibility === "private") notFound();
  if (viewer?.id !== id && visibility === "followers") {
    if (!viewer) notFound();
    const { data: relationship } = await admin.from("profile_follows").select("follower_id").eq("follower_id", viewer.id).eq("following_id", id).maybeSingle();
    if (!relationship) notFound();
  }
  type EventRow = { id: string; slug: string; title: string; cover_url: string | null; city: string | null; starts_at: string | null; status: string };
  const toEvent = (event: EventRow): HostEvent => {
    const date = event.starts_at ? new Date(event.starts_at) : null;
    return { id: event.id, eventId: event.slug, title: event.title, image: event.cover_url || "/events/palm-gathering.jpg", imageAlt: event.title, month: date ? date.toLocaleString("en-US", { month: "short", timeZone: eventTimeZone() }).toUpperCase() : "TBA", day: date ? date.toLocaleString("en-US", { day: "numeric", timeZone: eventTimeZone() }) : "—", location: event.city || "Location to be announced", detail: date ? date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: eventTimeZone() }) : "Date to be announced" };
  };
  // Server profiles are evaluated per request, so the current time is the correct
  // boundary between their upcoming and past events.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const hosted = (hostedRows || []).map((event) => toEvent(event));
  const cohosted = (cohostRows || []).flatMap((row) => {
    const event = row.events as unknown as EventRow | null;
    return event?.status === "published" && !(event as { unlisted?: boolean }).unlisted ? [toEvent(event)] : [];
  });
  const joinedRows: EventRow[] = [];
  if (preferences.show_upcoming_events === true) {
    const [{ data: ticketRows }, { data: guestRows }] = await Promise.all([
      admin.from("tickets").select("events(id,slug,title,cover_url,city,starts_at,status)").eq("owner_id", id).in("status", ["valid", "used"]),
      admin.from("event_guestlist_entries").select("events(id,slug,title,cover_url,city,starts_at,status)").eq("user_id", id).neq("status", "cancelled"),
    ]);
    for (const row of [...(ticketRows || []), ...(guestRows || [])]) {
      const event = row.events as unknown as EventRow | null;
      if (event?.status === "published" && (!event.starts_at || new Date(event.starts_at).getTime() >= now) && !joinedRows.some((item) => item.id === event.id)) joinedRows.push(event);
    }
  }
  const hostedUpcoming = hosted.filter((event) => !hostedRows?.find((row) => row.id === event.id)?.starts_at || new Date(hostedRows.find((row) => row.id === event.id)!.starts_at!).getTime() >= now);
  const upcoming = [...hostedUpcoming, ...joinedRows.filter((event) => !hostedUpcoming.some((item) => item.id === event.id)).map(toEvent)];
  const profile: HostProfile = { name: user.first_name || user.username || "Attnd member", handle: user.username ? `@${user.username}` : "", avatar: user.avatar_url || "", cover: "", bio: user.bio || "", role: hosted.length ? "Host" : cohosted.length ? "Co-Host" : "Attnd member", location: user.city || "", localMembership: localMembership?.locality, eventsHosted: String(hosted.length), followers: String(followerCount.count || 0), following: String(followingCount.count || 0), interests: user.interests || [], upcoming, hosted, cohosted, past: hosted.filter((event) => hostedRows?.find((row) => row.id === event.id)?.starts_at && new Date(hostedRows.find((row) => row.id === event.id)!.starts_at!).getTime() < now) };
  return <HostProfileScreen profile={profile} variant="person" profileId={id} points={{ level: points?.level || 0, lifetimePoints: points?.lifetime_earned || 0 }} />;
}
