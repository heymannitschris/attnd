export type SocialCategory = "Creators" | "Hosts" | "Attendees";

export type SocialPerson = {
  id: string;
  name: string;
  handle: string;
  location: string;
  portrait: number;
  category: SocialCategory;
  nearby: boolean;
  following: boolean;
};

export type SocialListKind = "followers" | "following";
