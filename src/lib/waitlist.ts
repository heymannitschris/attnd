import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, sendEmail } from "@/lib/email";
import { notifyUsers } from "@/lib/notify";

type Promoted = { waitlist_id: string; user_id: string; event_id: string; ticket_type_id: string };

export async function promoteWaitlist(ticketTypeId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("promote_event_waitlist", { p_ticket_type_id: ticketTypeId });
  if (error) throw error;
  const promoted = (data || []) as Promoted[];
  if (!promoted.length) return [];
  const { data: tier } = await admin.from("ticket_types").select("name,events(title,slug)").eq("id", ticketTypeId).maybeSingle();
  const event = tier?.events as unknown as { title?: string; slug?: string } | null;
  const href = event?.slug ? `/events/${event.slug}/tickets` : "/tickets";
  for (const offer of promoted) {
    await notifyUsers([offer.user_id], { category: "Tickets", title: "A ticket is available for you", body: `${event?.title || "Your event"} is reserved for you for 30 minutes.`, href, preference: "updates", metadata: { waitlistId: offer.waitlist_id, ticketTypeId } });
    const { data: authUser } = await admin.auth.admin.getUserById(offer.user_id);
    if (authUser.user?.email) {
      const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.attnd.space";
      await sendEmail({ to: authUser.user.email, subject: `Your ticket for ${event?.title || "Attnd"} is available`, html: `<h1>Your ticket is ready</h1><p>We reserved ${escapeHtml(tier?.name || "your ticket")} for 30 minutes.</p><p><a href="${origin}${href}">Buy your ticket</a></p>` });
    }
  }
  return promoted;
}

export async function promoteWaitlistsForOrder(orderId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("order_items").select("ticket_type_id").eq("order_id", orderId);
  for (const ticketTypeId of [...new Set((data || []).map((item) => item.ticket_type_id))]) await promoteWaitlist(ticketTypeId);
}
