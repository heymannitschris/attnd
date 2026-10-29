"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { HostEvent, HostProfile } from "@/types/host";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";
import { Avatar } from "@/components/ui/Avatar";
import { SocialConnectionsContent } from "./SocialConnectionsScreen";
import { ProfileInterestIcon } from "./ProfileInterestIcon";
import { useFollowing } from "./FollowingProvider";
import { HostReviewsPanel } from "./HostReviewsPanel";

const tabs = ["Events", "Reviews", "About", "Followers", "Following"] as const;
type Tab = (typeof tabs)[number];

function EventTile({ event, past }: { event: HostEvent; past?: boolean }) {
  return <Link href={`/events/${event.eventId ?? event.id}`} className="host-event-tile" aria-label={`Open ${event.title}`}>
    <div className="host-event-photo">
      <Image src={event.image} alt={event.imageAlt} fill sizes="94px" className="object-cover" />
    </div>
    <div className="host-event-copy">
      <small>{event.month} {event.day} · {event.detail}</small>
      <h3>{event.title}</h3>
      <p><DiscoverIcon name="pin" />{event.location}</p>
      {!past && event.going && <div className="host-event-attendees">
        <span className="host-mini-avatars" aria-hidden="true">{event.attendeePortraits?.map((portrait) => <span key={portrait} style={{ backgroundPosition: `${portrait * 33.333}% center` }} />)}</span>
        <span>{event.going} going</span>
      </div>}
    </div>
    <DiscoverIcon name="chevron" className="host-event-chevron" />
  </Link>;
}

function EventSection({ title, events, past }: { title: string; events: readonly HostEvent[]; past?: boolean }) {
  return <section className="host-event-section" aria-label={title}>
    <div className="host-section-title"><h2>{title}</h2></div>
    <div className="host-event-rail">{events.map((event) => <EventTile key={event.id} event={event} past={past} />)}</div>
  </section>;
}

export function HostProfileScreen({ profile, variant = "host", portrait, profileId, points }: { profile: HostProfile; variant?: "host" | "person"; portrait?: number; profileId?: string; backHref?: string; points?: { level: number; lifetimePoints: number } }) {
  const { isFollowing, toggleFollowing } = useFollowing();
  const followKey = profileId || profile.handle || profile.name;
  const following = isFollowing(followKey);
  const [activeTab, setActiveTab] = useState<Tab>("Events");

  return <div className="host-profile-screen">
    <div className="host-identity">
      <div className="host-intro">
        <div className="host-avatar">{portrait === undefined ? profile.avatar ? <Image src={profile.avatar} alt={profile.name} fill sizes="80px" className="object-cover" unoptimized={profile.avatar.startsWith("http") && !profile.avatar.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`)} /> : null : <Avatar name={profile.name} portrait={portrait} size={78} />}</div>
        <div className="host-name-block"><h1>{profile.name}<span aria-label="Verified host" className="host-verified"><DiscoverIcon name="check" /></span></h1><p>{profile.handle}</p></div>
        <div className="host-follow-actions"><button type="button" aria-pressed={following} onClick={() => void toggleFollowing(followKey)} className="host-follow">{following ? <><DiscoverIcon name="check" />Following</> : "Follow"}</button></div>
      </div>

      <div className="host-description"><p>{profile.bio}</p><p>{profile.role}</p>{profile.localMembership && <p className="host-local-badge">✓ Local · {profile.localMembership}</p>}<p className="host-location"><DiscoverIcon name="pin" />{profile.location}</p></div>

      <div className="host-stats"><button type="button" onClick={() => setActiveTab("Events")}><strong>{profile.eventsHosted}</strong><span>{variant === "person" ? "Events Attended" : "Events Hosted"}</span></button>{variant === "host" ? <><Link href="/hosts/lukas-weber/followers" aria-label={`View ${profile.followers} followers`}><strong>{profile.followers}</strong><span>Followers</span></Link><Link href="/hosts/lukas-weber/following" aria-label={`View ${profile.following} following`}><strong>{profile.following}</strong><span>Following</span></Link></> : <><button type="button" onClick={() => setActiveTab("Followers")}><strong>{profile.followers}</strong><span>Followers</span></button><button type="button" onClick={() => setActiveTab("Following")}><strong>{profile.following}</strong><span>Following</span></button></>}</div>
      {points && <Link href="/leaderboard" className="host-level-status"><span>Level {points.level}</span><strong>{points.lifetimePoints.toLocaleString()} points</strong><DiscoverIcon name="chevron" /></Link>}
      <div className="host-interests">{profile.interests.map((interest) => <span key={interest}><ProfileInterestIcon label={interest} />{interest}</span>)}</div>
    </div>

    <div role="tablist" aria-label="Host profile sections" className="host-tabs">{tabs.map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>

    {activeTab === "Events" ? <div className="host-events"><EventSection title="Upcoming Events" events={profile.upcoming} />{variant === "person" && profile.hosted?.length ? <EventSection title={`Hosted by ${profile.name}`} events={profile.hosted} /> : null}{profile.cohosted?.length ? <EventSection title={`Co-hosted by ${profile.name}`} events={profile.cohosted} /> : null}<EventSection title="Past Events" events={profile.past} past /></div> : activeTab === "Reviews" ? <HostReviewsPanel hostId={profileId} /> : activeTab === "Followers" || activeTab === "Following" ? <div role="tabpanel"><SocialConnectionsContent kind={activeTab.toLowerCase() as "followers" | "following"} preview /></div> : <div role="tabpanel" className="host-tab-panel"><p>{profile.bio}</p><p>{profile.role}</p><p>{profile.location}</p></div>}
  </div>;
}
