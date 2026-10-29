import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Refund Policy | Attnd" };

export default function RefundsPage() {
  return <LegalPage title="Refund Policy">
    <p>This policy covers tickets booked through Attnd. It supplements any mandatory rights you have under applicable law. Check the event page and your order summary for any additional host terms before paying.</p>
    <section><h2>If an event is cancelled</h2><p>If the host cancels an event and it does not take place, you can request a refund of the ticket price and Attnd platform fee you paid for that booking. We may need to confirm the cancellation with the host and payment provider. The refund is sent to the original payment method, subject to the payment provider’s processing time. A free ticket is cancelled without a charge.</p></section>
    <section><h2>If the event is rescheduled or materially changed</h2><p>We will communicate a confirmed new date or material change when we receive it from the host. If you cannot attend the new date or the change substantially affects what you purchased, contact us before the rescheduled event starts. We will review your request against the event terms and applicable law. Do not use or transfer the ticket while a refund request is being reviewed.</p></section>
    <section><h2>If you cannot attend</h2><p>A change in your plans does not automatically qualify for a refund. The host may offer a voluntary cancellation window or ticket transfer, if shown on the event page. For an event on a specific date or during a specific period, a general cooling-off right may not apply in some jurisdictions; mandatory local rights still take priority. Please contact us if you think you have a legal entitlement or exceptional circumstances.</p></section>
    <section><h2>How to request help</h2><p>Use the contact details in our <Link href="/legal">legal notice</Link>. Include the event name, booking email and order ID. Do not send card details. We will acknowledge the request, check the booking and tell you whether a refund is approved, declined or needs more information. Approved refunds go to the original payment method where possible; bank or card processing times are outside our control.</p></section>
    <section><h2>Chargebacks and duplicate payments</h2><p>If you see a duplicate or incorrect charge, contact us so we can investigate. Your right to ask your payment provider about a charge is unaffected. If a payment is reversed or refunded, the associated ticket may be invalidated and any related affiliate commission reversed.</p></section>
    <section><h2>Ticket protection</h2><p>Attnd does not currently offer a separate ticket-protection or insurance product. No extra protection charge should be added to a new booking.</p></section>
  </LegalPage>;
}
