import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { ticketConfirmationEmail, type EmailEvent } from "@/lib/emails/templates";

/** Send the buyer one confirmation email per order. Never throws (must not fail the Stripe webhook). */
export async function sendOrderConfirmation(orderId: string) {
  try {
    const admin = createAdminClient();
    // Atomic claim: only the first webhook delivery that flips the marker sends the mail.
    const { data: claimed, error: claimError } = await admin.from("orders").update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", orderId).is("confirmation_email_sent_at", null).in("payment_status", ["paid", "free"]).select("id,buyer_id,total_minor,currency").maybeSingle();
    if (claimError || !claimed) return;
    const release = () => admin.from("orders").update({ confirmation_email_sent_at: null }).eq("id", orderId);
    const [{ data: order }, { data: tickets }, { data: buyer }] = await Promise.all([
      admin.from("orders").select("events(title,slug,starts_at,ends_at,timezone,venue_name,address,city,latitude,longitude,cover_url)").eq("id", orderId).single(),
      admin.from("tickets").select("qr_token,status,ticket_types(name)").eq("order_id", orderId).eq("status", "valid"),
      admin.auth.admin.getUserById(claimed.buyer_id),
    ]);
    const email = buyer.user?.email;
    const event = order?.events as unknown as EmailEvent | null;
    if (!email || !event || !tickets?.length) { await release(); return; }
    const first = tickets[0];
    const qrPng = await QRCode.toBuffer(`attnd:ticket:${first.qr_token}`, { type: "png", width: 400, margin: 1, errorCorrectionLevel: "M" });
    const total = claimed.total_minor ? new Intl.NumberFormat("en", { style: "currency", currency: String(claimed.currency).toUpperCase() }).format(claimed.total_minor / 100) : undefined;
    const mail = ticketConfirmationEmail({
      event,
      buyerName: (buyer.user?.user_metadata?.first_name as string | undefined) || null,
      tickets: tickets.map((ticket, index) => ({ typeName: (ticket.ticket_types as unknown as { name?: string } | null)?.name || "Ticket", qrSrc: index === 0 ? "cid:ticket-qr" : undefined })),
      totalLabel: total,
      orderRef: orderId.slice(0, 8).toUpperCase(),
    });
    const result = await sendEmail({
      to: email, subject: mail.subject, html: mail.html, text: mail.text,
      attachments: [{ filename: "ticket-qr.png", content: qrPng.toString("base64"), content_type: "image/png", content_id: "ticket-qr" }],
      idempotencyKey: `order-confirmation/${orderId}`,
    });
    if (!result.sent) { console.error("Order confirmation not sent:", result.reason); await release(); }
  } catch (error) {
    console.error("Order confirmation failed:", error);
  }
}
