export type EventAttendee = {
  id: string;
  name: string;
  location: string;
  portrait: number;
  group: "local" | "traveler";
  friend?: boolean;
  following?: boolean;
};
