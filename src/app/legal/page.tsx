import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalOperator } from "@/lib/legal-operator";

export const metadata: Metadata = { title: "Legal Notice | Attnd" };

export default function LegalNoticePage() {
  return <LegalPage title="Legal Notice">
    <p>Operator of Attnd and contact point for questions about the service, bookings, privacy and complaints:</p>
    <address><strong>{legalOperator.name}</strong><br />{legalOperator.addressLines.map((line) => <span key={line}>{line}<br /></span>)}<a href={`mailto:${legalOperator.email}`}>{legalOperator.email}</a></address>
    <section><h2>Attnd online service</h2><p>Website: <a href="https://www.attnd.space">www.attnd.space</a>. The service helps people find events, book tickets and share events. Event descriptions and media are supplied by their hosts.</p></section>
    <section><h2>Policies</h2><p>Read our <Link href="/terms">Terms of Service</Link>, <Link href="/privacy">Privacy Policy</Link> and <Link href="/refunds">Refund Policy</Link>.</p></section>
  </LegalPage>;
}
