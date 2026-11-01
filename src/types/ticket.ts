export type TicketTier = {
  id: string;
  name: string;
  description: string;
  price: number;
  availability: "sold-out" | "available" | "limited";
  badge?: string;
  currency?: string;
};

export type CheckoutAttendee = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  userId?: string;
};
