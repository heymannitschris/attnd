import type { AppNotification, NotificationSetting } from "@/types/notification";

export const mockNotifications: readonly AppNotification[] = [
  { id: "invite-lukas", title: "Lukas Weber invited you to an event", detail: "Mindset Mastery Workshop", meta: "Oct 12, 2024 · Koh Phangan", time: "2m ago", day: "Today", category: "Events", unread: true, icon: "invite", portrait: 0, action: "invite" },
  { id: "commission", title: "You earned a new commission!", detail: "€24.00 from 2 ticket sales", meta: "Mindset Mastery Workshop", time: "12m ago", day: "Today", category: "Affiliates", unread: true, icon: "commission" },
  { id: "ticket-invitation", title: "Chris Mann sent you a ticket", detail: "Sunset Breathwork", meta: "Sep 29, 2024 · Koh Phangan", time: "1h ago", day: "Today", category: "Tickets", unread: true, icon: "transfer", portrait: 0, action: "ticket-invite" },
  { id: "sale", title: "New ticket sale", detail: "1 × Regular Ticket", meta: "Mindset Mastery Workshop", time: "2h ago", day: "Today", category: "Tickets", unread: false, icon: "ticket" },
  { id: "update", title: "Event update", detail: "The location has been updated", meta: "NINJA Community Meetup", time: "3h ago", day: "Today", category: "Events", unread: false, icon: "update" },
  { id: "follow", title: "David Kim started following you", detail: "", time: "1d ago", day: "Yesterday", category: "Social", unread: false, icon: "follow", portrait: 2 },
  { id: "trending", title: "Your event is trending! 🔥", detail: "+45% more views in the last 24 hours", meta: "Mindset Mastery Workshop", time: "1d ago", day: "Yesterday", category: "Events", unread: false, icon: "trending" },
];

export const notificationSettings: readonly NotificationSetting[] = [
  { id: "invites", title: "Event Invites", description: "When someone invites you to an event", icon: "calendar" },
  { id: "sales", title: "Ticket Sales", description: "When someone buys a ticket to your event", icon: "ticket" },
  { id: "transfers", title: "Ticket Transfers", description: "When tickets are transferred to you", icon: "users" },
  { id: "earnings", title: "Affiliate Earnings", description: "When you earn a commission", icon: "commission" },
  { id: "updates", title: "Event Updates", description: "Changes to events you host or attend", icon: "bell" },
  { id: "reminders", title: "Saved Event Reminders", description: "One day and three hours before a saved event", icon: "calendar" },
  { id: "followers", title: "Followers", description: "When someone follows you", icon: "profile" },
  { id: "mentions", title: "Mentions & Comments", description: "When someone mentions you or comments", icon: "comment" },
  { id: "news", title: "Platform News", description: "Important updates and announcements", icon: "news" },
];
