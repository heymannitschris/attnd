export type TicketStatus = "Upcoming" | "Past" | "Cancelled";

export type AppTicket = {
  id: string;
  eventId: string;
  title: string;
  image: string;
  imageAlt: string;
  date: string;
  time: string;
  location: string;
  ticketType: string;
  status: TicketStatus;
  startsAt?: string;
  endsAt?: string;
  qrToken?: string;
  orderId?: string;
  databaseEventId?: string;
  hostId?: string;
  hostName?: string;
  reviewed?: boolean;
};

export type TransferRecipient = {
  id: string;
  name: string;
  handle: string;
  portrait: number;
  online: boolean;
};
