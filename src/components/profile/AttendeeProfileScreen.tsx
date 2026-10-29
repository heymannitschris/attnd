import { HostProfileScreen } from "./HostProfileScreen";
import { lukasProfile } from "@/lib/mock-host-profile";
import type { EventAttendee } from "@/types/attendee";
import type { HostProfile } from "@/types/host";

const covers = ["/events/gallery-main-stage.jpg", "/events/gallery-sunset.jpg", "/events/gallery-dj.jpg", "/events/gallery-friends.jpg"] as const;

export function AttendeeProfileScreen({ person }: { person: EventAttendee }) {
  const slug = person.name.toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/^|$/g, "");
  const profile: HostProfile = {
    ...lukasProfile,
    name: person.name,
    handle: `@${slug}`,
    cover: covers[person.portrait] ?? covers[0],
    bio: person.group === "local" ? "Island life, good music and meaningful connections. 🌴" : "Exploring new places through events, people and unforgettable moments.",
    role: person.group === "local" ? "Community Member | Based in Thailand" : "Traveler & Event Lover",
    location: person.location,
    eventsHosted: person.group === "local" ? "24" : "11",
    followers: person.group === "local" ? "286" : "142",
    following: person.friend ? "118" : "84",
    interests: person.group === "local" ? ["Music", "Wellness", "Community", "Nature"] : ["Travel", "Music", "People", "Adventure"],
    hosted: person.group === "local" ? [lukasProfile.upcoming[0]] : [lukasProfile.upcoming[1]],
  };

  return <HostProfileScreen profile={profile} variant="person" portrait={person.portrait} profileId={person.id} points={{ level: person.portrait % 3, lifetimePoints: 120 + person.portrait * 175 }} />;
}
