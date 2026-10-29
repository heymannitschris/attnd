import type { SocialPerson } from "@/types/social";

export const followerPeople: readonly SocialPerson[] = [
  { id: "sophie", name: "Sophie Müller", handle: "@sophiem", location: "Berlin, Germany", portrait: 3, category: "Creators", nearby: false, following: true },
  { id: "david", name: "David Kim", handle: "@davidk", location: "Seoul, South Korea", portrait: 2, category: "Hosts", nearby: false, following: false },
  { id: "emma", name: "Emma Rossi", handle: "@emmarossi", location: "Milan, Italy", portrait: 1, category: "Creators", nearby: false, following: true },
  { id: "noah", name: "Noah Taylor", handle: "@noaht", location: "Melbourne, Australia", portrait: 0, category: "Attendees", nearby: false, following: false },
  { id: "ava", name: "Ava Chen", handle: "@avachen", location: "Singapore", portrait: 1, category: "Creators", nearby: false, following: false },
  { id: "liam", name: "Liam Carter", handle: "@_liamc", location: "London, UK", portrait: 0, category: "Hosts", nearby: false, following: true },
  { id: "isabella", name: "Isabella Garcia", handle: "@isabellag", location: "Barcelona, Spain", portrait: 3, category: "Attendees", nearby: false, following: false },
  { id: "ethan", name: "Ethan Walker", handle: "@ethanww", location: "Toronto, Canada", portrait: 0, category: "Creators", nearby: false, following: false },
  { id: "chloe", name: "Chloe Martin", handle: "@chloem", location: "Paris, France", portrait: 3, category: "Creators", nearby: false, following: true },
  { id: "daniel", name: "Daniel Schmidt", handle: "@daniel.s", location: "Munich, Germany", portrait: 0, category: "Hosts", nearby: false, following: false },
  { id: "maya", name: "Maya Singh", handle: "@maya.s", location: "Koh Phangan, Thailand", portrait: 1, category: "Attendees", nearby: true, following: false },
];

export const followingPeople: readonly SocialPerson[] = [
  followerPeople[0],
  { id: "lukas-steiner", name: "Lukas Steiner", handle: "@lukassteiner", location: "Vienna, Austria", portrait: 0, category: "Hosts", nearby: false, following: true },
  followerPeople[2],
  { id: "nina", name: "Nina Patel", handle: "@ninapatel", location: "Bali, Indonesia", portrait: 1, category: "Creators", nearby: false, following: true },
  { ...followerPeople[1], following: true },
  { ...followerPeople[4], following: true },
  { ...followerPeople[3], following: true },
  { id: "sofia", name: "Sofia Ramirez", handle: "@sofiar", location: "Mexico City, Mexico", portrait: 3, category: "Attendees", nearby: false, following: true },
  { ...followerPeople[7], following: true },
  { id: "mia", name: "Mia Johansson", handle: "@miaj", location: "Stockholm, Sweden", portrait: 3, category: "Creators", nearby: false, following: true },
  { ...followerPeople[10], following: true },
];
