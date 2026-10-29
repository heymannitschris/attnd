export type NotificationCategory = "Events" | "Tickets" | "Affiliates" | "Social";

export type AppNotification = {
  id: string;
  title: string;
  detail: string;
  meta?: string;
  time: string;
  day: "Today" | "Yesterday";
  category: NotificationCategory;
  unread: boolean;
  icon: "invite" | "commission" | "transfer" | "ticket" | "update" | "follow" | "trending";
  portrait?: number;
  action?: "invite" | "ticket-invite";
};

export type NotificationSetting = {
  id: string;
  title: string;
  description: string;
  icon: "calendar" | "ticket" | "users" | "commission" | "bell" | "profile" | "comment" | "news";
};
