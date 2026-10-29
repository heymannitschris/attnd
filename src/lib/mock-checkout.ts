import type { CheckoutAttendee } from "@/types/ticket";

export function makeCheckoutAttendees(quantity: number): CheckoutAttendee[] {
  return Array.from({ length: quantity }, (_, index) => ({ id: index + 1, firstName: "", lastName: "", email: "" }));
}
