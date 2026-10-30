import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { ticketTransferEmail } from "@/lib/emails/templates";
import { notifyUsers } from "@/lib/notify";
import { getAppUrl } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json() as { ticketId?: string; recipientId?: string; email?: string; message?: string };
  if (!body.ticketId) return NextResponse.json({ error: "Ticket is required" }, { status: 400 });
  const recipientId = body.recipientId && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.recipientId) ? body.recipientId : null;
  const email = body.email?.trim().toLowerCase() || "";
  if (!recipientId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Choose a recipient or enter an email" }, { status: 400 });
  const { data: transfer, error } = await supabase.rpc("create_ticket_transfer", { p_ticket_id: body.ticketId, p_recipient_id: recipientId, p_recipient_email: email, p_message: String(body.message || "").slice(0, 300) });
  if (error || !transfer) return NextResponse.json({ error: error?.message || "Transfer failed" }, { status: 400 });
  const row = Array.isArray(transfer) ? transfer[0] : transfer;
  const claimUrl = new URL(`/tickets/transfer/claim?token=${row.claim_token}`, getAppUrl(request)).toString();
  const admin = createAdminClient();
  const { data: ticket } = await admin.from("tickets").select("events(title,slug,starts_at,ends_at,timezone,venue_name,address,city,latitude,longitude,cover_url)").eq("id", body.ticketId).single();
  const transferEvent = ticket?.events as unknown as ({ title?: string } & Record<string, unknown>) | null;
  const eventTitle = transferEvent?.title || "an event";
  if (recipientId) await notifyUsers([recipientId], { category: "Tickets", title: "A ticket was sent to you", body: `${eventTitle}. Accept it to add it to your tickets.`, href: `/tickets/transfer/claim?token=${row.claim_token}`, email: !email, metadata: { transfer_id: row.id } });
  let emailSent: boolean | undefined;
  if (email) {
    const mail = ticketTransferEmail({ eventTitle, message: body.message, claimUrl, event: transferEvent ? { ...transferEvent, title: eventTitle } : undefined });
    emailSent = (await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text, idempotencyKey: `ticket-transfer/${row.id}` })).sent;
  }
  return NextResponse.json({ transferId: row.id, claimUrl, emailSent });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { token } = await request.json() as { token?: string };
  if (!token) return NextResponse.json({ error: "Transfer token is required" }, { status: 400 });
  const { data: ticketId, error } = await supabase.rpc("accept_ticket_transfer", { p_claim_token: token });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ accepted: true, ticketId });
}
