import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { waitlistOfferEmail } from "@/lib/emails/templates";
import { notifyUsers } from "@/lib/notify";

type Promoted = { waitlist_id: string; user_id: string; event_id: string; ticket_type_id: string };

export async function promoteWaitlist(ticketTypeId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("promote_event_waitlist", { p_ticket_type_id: ticketTypeId });
  if (error) throw error;
  const promoted = (data || []) as Promoted[];
  if (!promoted.length) return [];
  const { data: tier } = await admin.from("ticket_types").select("name,events(title,slug,starts_at,ends_at,timezone,venue_name,address,city,latitude,longitude,cover_url)").eq("id", ticketTypeId).maybeSingle();
  const event = tier?.events as unknown as ({ title?: string; slug?: string } & Record<string, unknown>) | null;
  const href = event?.slug ? `/events/${event.slug}/tickets` : "/tickets";
  for (const offer of promoted) {
    await notifyUsers([offer.user_id], { category: "Tickets", title: "A ticket is available for you", body: `${event?.title || "Your event"} is reserved for you for 30 minutes.`, href, preference: "updates", email: false, metadata: { waitlistId: offer.waitlist_id, ticketTypeId } });
    const { data: authUser } = await admin.auth.admin.getUserById(offer.user_id);
    if (authUser.user?.email) {
      const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.attnd.space";
      const mail = waitlistOfferEmail({ event: { ...(event || {}), title: event?.title || "your event" }, tierName: tier?.name, href: `${origin}${href}` });
      await sendEmail({ to: authUser.user.email, subject: mail.subject, html: mail.html, text: mail.text, idempotencyKey: `waitlist-offer/${offer.waitlist_id}` });
    }
  }
  return promoted;
}

export async function promoteWaitlistsForOrder(orderId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("order_items").select("ticket_type_id").eq("order_id", orderId);
  for (const ticketTypeId of [...new Set((data || []).map((item) => item.ticket_type_id))]) await promoteWaitlist(ticketTypeId);
}
