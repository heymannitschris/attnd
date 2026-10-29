import type { AppTicket, TransferRecipient } from "@/types/app-ticket";
import type { TicketTier } from "@/types/ticket";

export const mockTicketTiers: readonly TicketTier[] = [
  { id: "early-bird", name: "Early Bird", description: "Limited quantity · Access to event", price: 500, availability: "sold-out", badge: "Best Deal" },
  { id: "round-1", name: "Round 1", description: "General admission · Access to event", price: 800, availability: "available" },
  { id: "round-2", name: "Round 2", description: "General admission · Access to event", price: 1000, availability: "limited" },
  { id: "vip", name: "VIP", description: "Fast track entry · VIP area · 2 free drinks", price: 2500, availability: "limited" },
];

export const mockTickets: readonly AppTicket[] = [
  { id: "sunset-breathwork", eventId: "sunset-breathwork", title: "Sunset Breathwork", image: "/events/gallery-sunset.jpg", imageAlt: "Sunset event beneath palms", date: "Sun, Sep 29, 2024", time: "5:30 PM – 7:30 PM", location: "Srithanu, Koh Phangan", ticketType: "General Admission", status: "Upcoming" },
  { id: "ninja-gathering", eventId: "jungle-experience", title: "NINJA Gathering", image: "/events/gallery-fire-show.jpg", imageAlt: "Night gathering beneath palms", date: "Sat, Oct 12, 2024", time: "6:00 PM – 2:00 AM", location: "Haad Rin, Koh Phangan", ticketType: "VIP Admission", status: "Upcoming" },
  { id: "creator-workshop", eventId: "palm-grove-sessions", title: "Creator Workshop", image: "/events/beach-gathering.jpg", imageAlt: "Tropical coastal workshop location", date: "Tue, Nov 5, 2024", time: "10:00 AM – 5:00 PM", location: "Koh Phangan", ticketType: "General Admission", status: "Upcoming" },
  { id: "jungle-reunion", eventId: "jungle-experience", title: "Jungle Reunion", image: "/events/gallery-dancefloor.jpg", imageAlt: "Crowd dancing beneath stage lights", date: "Fri, Aug 23, 2024", time: "8:00 PM – Late", location: "Baan Tai, Koh Phangan", ticketType: "General Admission", status: "Past" },
  { id: "island-talk", eventId: "palm-grove-sessions", title: "Island Creators Talk", image: "/hosts/web3-talk.jpg", imageAlt: "Speaker presenting at an event", date: "Sat, Aug 3, 2024", time: "2:00 PM – 5:00 PM", location: "Thong Sala, Koh Phangan", ticketType: "General Admission", status: "Cancelled" },
];

export const freeCommunityTicket: AppTicket = {
  id: "island-community-sunset-free",
  eventId: "island-community-sunset",
  title: "Island Community Sunset",
  image: "/events/gallery-friends.jpg",
  imageAlt: "Friends meeting at a sunset gathering",
  date: "Wed, Oct 2, 2024",
  time: "5:00 PM – Sunset",
  location: "Zen Beach, Koh Phangan",
  ticketType: "Free RSVP",
  status: "Upcoming",
};

export const transferRecipients: readonly TransferRecipient[] = [
  { id: "lea", name: "Lea Schmidt", handle: "@leaschmidt", portrait: 3, online: true },
  { id: "max", name: "Max Bauer", handle: "@maxbauer", portrait: 0, online: false },
  { id: "sophie", name: "Sophie Keller", handle: "@sophiekeller", portrait: 1, online: false },
  { id: "luca", name: "Luca Romano", handle: "@lucaromano", portrait: 2, online: true },
  { id: "nina", name: "Nina Patel", handle: "@ninapatel", portrait: 1, online: false },
  { id: "jonas", name: "Jonas Weber", handle: "@jonasweber", portrait: 0, online: false },
  { id: "emma", name: "Emma Fischer", handle: "@emmafischer", portrait: 3, online: true },
];
