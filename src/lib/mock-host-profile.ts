import type { HostProfile } from "@/types/host";

export const lukasProfile: HostProfile = {
  name: "Lukas Weber",
  handle: "@lukasw",
  avatar: "/hosts/lukas-avatar.jpg",
  cover: "/hosts/lukas-cover.jpg",
  bio: "Events. Community. A better tomorrow. 🌴",
  role: "Host & Creator | Based in Thailand",
  location: "Koh Phangan, Thailand",
  eventsHosted: "128",
  followers: "12.4K",
  following: "426",
  interests: ["Mindset", "Health", "Travel", "Community", "Web3"],
  upcoming: [
    { id: "mindset-mastery", eventId: "palm-grove-sessions", title: "Mindset Mastery Workshop", image: "/events/gallery-sunset.jpg", imageAlt: "Palms at sunset on Koh Phangan", month: "OCT", day: "12", location: "Koh Phangan, Thailand", detail: "10:00 – 18:00", going: 86, attendeePortraits: [0, 1, 2] },
    { id: "yoga-breath", eventId: "sunset-breathwork", title: "Yoga & Breath Retreat", image: "/hosts/yoga-retreat.jpg", imageAlt: "Yoga gathering by the sea", month: "NOV", day: "8", location: "Koh Phangan, Thailand", detail: "08:00 – 17:00", going: 42, attendeePortraits: [1, 2, 3] },
  ],
  past: [
    { id: "ninja-community", eventId: "jungle-experience", title: "NINJA Community Meetup", image: "/events/gallery-main-stage.jpg", imageAlt: "Crowd enjoying a night event", month: "SEP", day: "14", location: "Koh Phangan, Thailand", detail: "120 attended" },
    { id: "web3-freedom", eventId: "moonlight-beach", title: "Web3 & Freedom Talk", image: "/hosts/web3-talk.jpg", imageAlt: "Speaker addressing a community audience", month: "AUG", day: "3", location: "Koh Phangan, Thailand", detail: "98 attended" },
  ],
};
