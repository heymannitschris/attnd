import type { EventDetails, EventPerson } from "@/types/event";
import { mockEvents } from "./mock-events";

const attendees: readonly EventPerson[] = [
  { id: "alex", name: "Alex", portrait: 0 },
  { id: "maya", name: "Maya", portrait: 1 },
  { id: "jay", name: "Jay", portrait: 2 },
  { id: "kim", name: "Kim", portrait: 3 },
];

const descriptions: Record<string, { summary: string; more: string; host: string }> = {
  "island-community-sunset": {
    summary: "Meet new people by the sea at a relaxed sunset gathering for the whole island community. Come alone or bring friends — everyone is welcome.",
    more: "There is no ticket price and no dress code. Reserve your free spot so the host knows you are coming, then meet us by the main entrance at Zen Beach.",
    host: "Koh Phangan Community",
  },
  "sunset-breathwork": {
    summary: "Join us for a transformative sunset breathwork session on the beautiful beaches of Koh Phangan. Let go, reset, and connect with yourself and an amazing community. All levels are welcome.",
    more: "Bring a mat or towel, comfortable clothes and an open mind. The exact Secret Beach location is shared after booking.",
    host: "Island Breathwork",
  },
  "jungle-experience": {
    summary: "An immersive jungle party experience with international DJs, fire shows, art and a like-minded community. Good music. Good people. Better days.",
    more: "Spend the evening beneath the palms, surrounded by music, warm lights and the island community. Explore the art, meet new people and dance late into the night.",
    host: "Jungle Collective",
  },
  "moonlight-beach": {
    summary: "Music by the water, warm sea air and a dance floor under the stars. Come together for a laid-back evening on the beach.",
    more: "Local selectors set the mood as the moon rises over the bay. Bring your friends and settle into an evening of music and conversation by the shoreline.",
    host: "Moonlight Collective",
  },
  "palm-grove-sessions": {
    summary: "An evening of music and connection beneath the palms. Watch the sunset and find your rhythm with the island community.",
    more: "An intimate gathering with local DJs, soft lights and space to unwind. Stay for the music and meet the people who make this island special.",
    host: "Palm Grove Collective",
  },
};

export const mockEventDetails: readonly EventDetails[] = mockEvents.map((event) => ({
  eventId: event.id,
  description: descriptions[event.id].summary,
  moreDescription: descriptions[event.id].more,
  endTime: event.id === "sunset-breathwork" ? "7:30 PM" : "Late",
  highlights: event.id === "sunset-breathwork" ? [
    { label: "Breathwork", icon: "leaf" },
    { label: "Community", icon: "users" },
    { label: "Sunset Vibes", icon: "flame" },
    { label: "Natural Setting", icon: "leaf" },
  ] : [
    { label: "Live DJs", icon: "music" },
    { label: "Fire Show", icon: "flame" },
    { label: "Jungle Location", icon: "leaf" },
    { label: "Open Minded People", icon: "users" },
  ],
  host: { id: `${event.id}-host`, name: descriptions[event.id].host, portrait: 0, eventCount: 12, rating: "4.8", verified: true },
  attendees,
  photos: event.id === "sunset-breathwork" ? [
    { src: "/events/gallery-sunset.jpg", alt: "Sunset breathwork gathering beneath palms", title: "Sunset Session", caption: "Breathe as the sun meets the sea", category: "Atmosphere", likes: 82 },
    { src: "/events/beach-gathering.jpg", alt: "Warm sunset gathering by the beach", title: "Secret Beach", caption: "A natural setting on Koh Phangan", category: "Location", likes: 64 },
    { src: "/events/people.jpg", alt: "Community gathering together", title: "Community", caption: "Connect with like-minded people", category: "People", likes: 71 },
    { src: "/events/gallery-fire-show.jpg", alt: "Warm lights at the evening gathering", title: "Afterglow", caption: "Stay present into the evening", category: "Atmosphere", likes: 55 },
  ] : event.id === "jungle-experience" ? [
    { src: "/events/gallery-main-stage.jpg", alt: "Crowd at a jungle stage under palms and turquoise neon lights", title: "Main Stage", caption: "The heart of Jungle Experience", category: "Stage", likes: 128 },
    { src: "/events/gallery-sunset.jpg", alt: "Sunset over the sea and palms", title: "Golden Hour", caption: "The island before the music begins", category: "Atmosphere", likes: 94 },
    { src: "/events/gallery-dj.jpg", alt: "DJ playing to a crowd under teal lights", title: "Live DJs", caption: "Soundtrack to the night", category: "Stage", likes: 112 },
    { src: "/events/gallery-friends.jpg", alt: "Friends laughing together at the party", title: "Good People", caption: "Moments with your people", category: "People", likes: 86 },
    { src: "/events/gallery-jungle-entrance.jpg", alt: "Warm lanterns along a jungle entrance", title: "Jungle Entrance", caption: "Follow the lights in", category: "Location", likes: 76 },
    { src: "/events/beach-gathering.jpg", alt: "Beach crowd with DJ and warm lanterns", title: "By the Water", caption: "An island night together", category: "Location", likes: 69 },
    { src: "/events/gallery-dancefloor.jpg", alt: "Crowd dancing under teal lights and palm trees", title: "Dance Floor", caption: "Stay for one more song", category: "Atmosphere", likes: 103 },
    { src: "/events/palm-gathering.jpg", alt: "Palm grove party with warm lights", title: "Under the Palms", caption: "The island after dark", category: "Atmosphere", likes: 81 },
  ] : [
    { src: event.image, alt: event.imageAlt, title: event.title, caption: "Event atmosphere", category: "Atmosphere", likes: 0 },
    ...mockEvents.filter((other) => other.id !== event.id).map((other) => ({ src: other.image, alt: other.imageAlt, title: other.title, caption: "Island event moments", category: "Atmosphere" as const, likes: 0 })),
  ],
  video: event.id === "jungle-experience" ? {
    src: "/events/event-preview.mp4",
    poster: "/events/gallery-fire-show.jpg",
    alt: "Preview clip of Jungle Experience",
    title: "Event Preview",
    caption: "A glimpse of the night",
    category: "Stage",
    duration: "0:06",
    durationSeconds: 6,
    frames: ["/events/gallery-fire-show.jpg", "/events/gallery-main-stage.jpg", "/events/gallery-friends.jpg"],
    likes: 57,
  } : undefined,
  admission: event.id === "island-community-sunset" ? "rsvp" : "tickets",
}));
