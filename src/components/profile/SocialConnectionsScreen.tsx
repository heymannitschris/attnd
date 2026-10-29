"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";
import { Avatar } from "@/components/ui/Avatar";
import { followerPeople, followingPeople } from "@/lib/mock-social";
import type { SocialListKind, SocialPerson } from "@/types/social";
import { useFollowing } from "./FollowingProvider";

const profilePath = "/hosts/lukas-weber";

function PersonRow({ person, isFollowing, onToggle }: { person: SocialPerson; isFollowing: boolean; onToggle: () => void }) {
  return <div className="social-person-row">
    <Link href={`/people/${person.id}`} className="social-person-profile" aria-label={`Open ${person.name}'s profile`}>
      <Avatar name={person.name} portrait={person.portrait} size={42} />
      <span className="social-person-copy"><strong>{person.name}</strong><span>{person.handle}</span><small>{person.location}</small></span>
    </Link>
    <button type="button" aria-pressed={isFollowing} onClick={onToggle} className="social-follow-button">{isFollowing && <DiscoverIcon name="check" />}{isFollowing ? "Following" : "Follow"}</button>
  </div>;
}

export function SocialConnectionsContent({ kind, preview = false }: { kind: SocialListKind; preview?: boolean }) {
  const people = kind === "followers" ? followerPeople : followingPeople;
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState("All");
  const { isFollowing, toggleFollowing } = useFollowing();
  const filters = kind === "followers" ? ["All", "Nearby", "Creators", "Hosts", "Attendees"] : ["All", "Creators", "Hosts", "Attendees", "Nearby"];
  const visible = useMemo(() => people.filter((person) => {
    const matchesQuery = `${person.name} ${person.handle} ${person.location}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim());
    const matchesFilter = filter === "All" || (filter === "Nearby" ? person.nearby : person.category === filter);
    return matchesQuery && matchesFilter;
  }).slice(0, preview ? 5 : filter === "All" && !query.trim() ? 10 : undefined), [people, query, filter, preview]);
  const title = kind === "followers" ? "Followers (12.4K)" : "Following (426)";
  const listPath = `${profilePath}/${kind}`;

  return <section className={preview ? "social-connections-preview" : "social-connections-full"} aria-label={title}>
    {preview ? <div className="social-preview-heading"><Link href={listPath}>{title}</Link><button type="button" aria-expanded={searchOpen} aria-label={`Search ${kind}`} onClick={() => setSearchOpen((open) => !open)}><DiscoverIcon name="search" /></button></div> : <header className="social-full-heading"><Link href={profilePath} aria-label="Back to Lukas Weber" className="icon-button"><DiscoverIcon name="chevron" className="h-5 w-5 rotate-90" /></Link><h1>{title}</h1><button type="button" aria-expanded={searchOpen} aria-label={`Search ${kind}`} onClick={() => setSearchOpen((open) => !open)}><DiscoverIcon name="search" /></button></header>}
    {searchOpen && <label className="social-search"><DiscoverIcon name="search" /><input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${kind}...`} aria-label={`Search ${kind}`} /></label>}
    {!preview && <div role="tablist" aria-label={`Filter ${kind}`} className="social-filters">{filters.map((option) => <button key={option} type="button" role="tab" aria-selected={filter === option} onClick={() => setFilter(option)}>{option}</button>)}</div>}
    <div className="social-person-list">{visible.map((person) => <PersonRow key={person.id} person={person} isFollowing={isFollowing(person.id)} onToggle={() => void toggleFollowing(person.id)} />)}</div>
    {visible.length === 0 && <p className="social-no-results">No people found.</p>}
  </section>;
}

export function SocialConnectionsScreen({ kind }: { kind: SocialListKind }) {
  return <div className="social-connections-screen"><SocialConnectionsContent kind={kind} /></div>;
}
