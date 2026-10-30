import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return <div className="legal-page">
    <header className="legal-header"><Link href="/" aria-label="Attnd home" className="legal-brand">attnd</Link><nav aria-label="Legal pages"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/refunds">Refunds</Link><Link href="/legal">Legal notice</Link></nav></header>
    <main className="legal-main"><p className="legal-kicker">Attnd · Last updated September 22, 2026</p><h1>{title}</h1>{children}</main>
    <footer className="legal-footer"><span>© {new Date().getFullYear()} Attnd</span><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/refunds">Refunds</Link><Link href="/support">Support</Link><Link href="/legal">Legal notice</Link></footer>
  </div>;
}
