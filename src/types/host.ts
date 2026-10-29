export type HostEvent = {
  id: string;
  eventId?: string;
  title: string;
  image: string;
  imageAlt: string;
  month: string;
  day: string;
  location: string;
  detail: string;
  going?: number;
  attendeePortraits?: readonly number[];
};

export type HostProfile = {
  name: string;
  handle: string;
  avatar: string;
  cover: string;
  bio: string;
  role: string;
  location: string;
  localMembership?: string;
  eventsHosted: string;
  followers: string;
  following: string;
  interests: readonly string[];
  upcoming: readonly HostEvent[];
  hosted?: readonly HostEvent[];
  cohosted?: readonly HostEvent[];
  past: readonly HostEvent[];
};
