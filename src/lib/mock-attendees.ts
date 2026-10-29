import type { EventAttendee } from "@/types/attendee";

export const mockAttendees: readonly EventAttendee[] = [
  { id: "lukas-m", name: "Lukas M.", location: "Freiburg, Germany", portrait: 0, group: "traveler" },
  { id: "sophie-k", name: "Sophie K.", location: "Koh Phangan, Thailand", portrait: 1, group: "local", friend: true, following: true },
  { id: "marco-b", name: "Marco B.", location: "Berlin, Germany", portrait: 2, group: "traveler" },
  { id: "emma-l", name: "Emma L.", location: "London, UK", portrait: 3, group: "traveler" },
  { id: "noah-t", name: "Noah T.", location: "Sydney, Australia", portrait: 0, group: "traveler" },
  { id: "maya-s", name: "Maya S.", location: "Koh Phangan, Thailand", portrait: 1, group: "local", friend: true },
  { id: "jules-a", name: "Jules A.", location: "Koh Phangan, Thailand", portrait: 2, group: "local" },
  { id: "alex-r", name: "Alex R.", location: "Melbourne, Australia", portrait: 3, group: "traveler", friend: true },
];
