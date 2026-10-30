import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/support";

export const metadata: Metadata = { title: "Help & Support | Attnd", description: "Get help with Attnd tickets, events, your account and safety reports." };

export default function SupportPage() {
  return <LegalPage title="Help & Support">
    <p>Need help with Attnd? Email us at <a href={`mailto:${SUPPORT_EMAIL}`}><strong>{SUPPORT_EMAIL}</strong></a>. We usually reply within 24 hours.</p>
    <section><h2>Tickets and payments</h2><ul><li>Your tickets are in the <Link href="/tickets">Tickets</Link> tab. Show the QR code at the entrance.</li><li>Refund requests follow the event&apos;s <Link href="/refunds">refund policy</Link>. Include your order email and event name when you contact us.</li></ul></section>
    <section><h2>Your account</h2><ul><li>Change your email or set a password under Profile → Settings → Login &amp; security.</li><li>You can delete your account at any time under Profile → Settings → Delete account. Your profile is removed and ticket records are anonymized.</li></ul></section>
    <section><h2>Safety and reporting</h2><p>Attnd has zero tolerance for abusive, hateful, sexual or illegal content and for harassment. Report content or users to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We review every report within 24 hours and remove offending content and accounts.</p></section>
    <section><h2>Hosts</h2><p>Questions about creating events, check-in or payouts? Email us with your event name and we&apos;ll help you directly.</p></section>
    <section><h2>Legal</h2><p>See our <Link href="/terms">Terms of Service</Link>, <Link href="/privacy">Privacy Policy</Link> and <Link href="/legal">legal notice</Link>.</p></section>
  </LegalPage>;
}
