"use client";

import Image from "next/image";
import Link from "next/link";
import { AppScreenCrop, type AppScreenView } from "./AppScreenCrop";
import { HostMarketingDesktop } from "./HostMarketingDesktop";
import { MarketingLanguageToggle } from "./MarketingLanguageToggle";
import "./MobileMarketing.css";

const benefits: { number: string; title: string; text: string; screen?: AppScreenView }[] = [
  { number: "01", title: "Community", text: "Dein Event wird von Menschen entdeckt, die nach Erlebnissen suchen.", screen: "discover" },
  { number: "02", title: "Tickets & Zahlung", text: "Verkaufe Tickets und behalte Buchungen und Einnahmen im Blick.", screen: "dashboard" },
  { number: "03", title: "Co-Hosts", text: "Plane zusammen und teile Einnahmen mit deinem Team.", screen: "cohosts" },
  { number: "04", title: "QR-Check-in", text: "Prüfe Tickets am Eingang direkt mit der Kamera.", screen: "checkin" },
  { number: "05", title: "Teammanagement", text: "Vergüte Security, Cleaning und Management automatisch per Fixbetrag oder Umsatzanteil.", screen: "team" },
  { number: "06", title: "Affiliates", text: "Lass andere dein Event über persönliche Links empfehlen.", screen: "affiliates" },
  { number: "07", title: "Gästeliste", text: "Verwalte Gäste und Plus-ones und markiere ihre Ankunft direkt am Eingang.", screen: "guestlist" },
  { number: "08", title: "Local Membership", text: "Gib verifizierten Locals kostenlosen oder vergünstigten Eintritt.", screen: "locals" },
];

function Arrow() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 12h16m-7-7 7 7-7 7" /></svg>;
}

const PHONE_LABEL = { dashboard: "Attnd Eventverwaltung", event: "Attnd Eventansicht", discover: "Attnd Entdecken" } as const;

function AppPhone({ view, className = "" }: { view: "dashboard" | "event" | "discover"; className?: string }) {
  return <div className={"attnd-mobile-phone " + className} aria-label={PHONE_LABEL[view]}>
    <span className="attnd-mobile-phone-island" aria-hidden="true" />
    <iframe title={PHONE_LABEL[view]} src={`/marketing-preview?view=${view}${view === "discover" ? "&demo=hero" : ""}`} loading="lazy" tabIndex={-1} />
  </div>;
}

export function MarketingSite() {
  return <><HostMarketingDesktop /><div className="attnd-mobile-site"><div className="attnd-mobile-marketing">
    <header className="attnd-mobile-nav">
      <a href="#mobile-top" aria-label="Attnd Startseite"><Image src="/brand/attnd-logo-serif-white.png" alt="attnd" width={1774} height={887} priority /></a>
      <a href="#mobile-start" className="attnd-mobile-nav-link">Herunterladen <Arrow /></a>
    </header>
    <main>
      <section className="attnd-mobile-hero" id="mobile-top">
        <div className="attnd-mobile-hero-copy"><span className="attnd-mobile-kicker">DIE APP FÜR EVENTVERANSTALTER</span><h1>Dein Event.<br />Deine Leute.<br /><em>Ein Ort.</em></h1><p>Plane dein Event, erreiche Menschen in der Attnd-Community und behalte alles im Griff.</p><ul className="attnd-mobile-points"><li>Tickets &amp; Zahlungen</li><li>Community-Reichweite</li><li>Co-Hosts &amp; Affiliates</li><li>QR-Check-in</li></ul><a className="attnd-mobile-primary" href="#mobile-start">Event starten <Arrow /></a></div>
        <div className="attnd-mobile-hero-art"><div className="attnd-mobile-star" aria-hidden="true" /><div className="attnd-mobile-phones"><AppPhone view="discover" className="attnd-mobile-phone-back" /><AppPhone view="dashboard" className="attnd-mobile-phone-front" /></div><span className="attnd-mobile-preview-label">Echte App-Oberfläche · Beispieldaten</span></div>
      </section>
      <div className="attnd-mobile-strip" aria-label="App herunterladen">
        <a href="/onboarding" aria-label="Im App Store laden"><b className="store-apple"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.27 3.57c.76-.97 1.34-2.34 1.13-3.57-1.25.09-2.71.88-3.56 1.9-.77.93-1.41 2.31-1.16 3.48 1.37.04 2.77-.77 3.59-1.81ZM24 17.53c-.55 1.24-.81 1.79-1.51 2.89-.98 1.54-2.36 3.46-4.07 3.48-1.52.02-1.91-1.02-3.97-1-2.06.01-2.49 1.02-4.01 1-1.71-.02-3.02-1.75-4-3.29C3.7 16.3 3.42 11.26 5.1 8.42c1.19-2.02 3.07-3.2 4.84-3.2 1.8 0 2.93 1.03 4.42 1.03 1.44 0 2.32-1.03 4.4-1.03 1.57 0 3.24.85 4.43 2.32-3.89 2.13-3.26 7.68.81 9.99Z" /></svg></b><span><small>Download on the</small>App Store</span></a>
        <a href="/onboarding" aria-label="Bei Google Play laden"><b className="store-google-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#ffffff" d="M3.2 2.4 13.8 12 3.2 21.6c-.4-.5-.7-1.2-.7-2V4.4c0-.8.3-1.5.7-2Z"/><path fill="#4285f4" d="m13.8 12 3.2-2.9L5.2 2.3c-.7-.4-1.4-.3-2 .1L13.8 12Z"/><path fill="#fbbc04" d="m13.8 12-10.6 9.6c.6.4 1.3.5 2 .1L17 14.9 13.8 12Z"/><path fill="#ea4335" d="M21 11.2 17 9l-3.2 3 3.2 2.9 4-2.2c.7-.4.7-1.1 0-1.5Z"/></svg></b><span><small>GET IT ON</small>Google Play</span></a>
      </div>
      <section className="attnd-mobile-community"><div className="attnd-mobile-community-photo"><Image src="/events/jungle-experience.jpg" alt="Menschen feiern gemeinsam bei einem Event" fill sizes="100vw" /><span>DEINE COMMUNITY IST SCHON DA</span></div><div className="attnd-mobile-section-copy"><span className="attnd-mobile-kicker">DEIN VORTEIL ALS HOST</span><h2>Das Tinder<br />{" "}für <em>Events.</em></h2><p>Menschen entdecken Erlebnisse beim Swipen. Dein Event erscheint dort, wo sie bereits nach ihrem nächsten Moment suchen.</p><div className="attnd-mobile-event-preview"><AppPhone view="event" /></div></div></section>
      <section className="attnd-mobile-benefits" id="mobile-features"><span className="attnd-mobile-kicker">ALLES FÜR DEIN EVENT</span><h2>Mehr Möglichkeiten.<br /><em>Weniger Aufwand.</em></h2><div>{benefits.map((benefit) => <article key={benefit.number}><span>{benefit.number}</span><div><h3>{benefit.title}</h3><p>{benefit.text}</p></div>{benefit.screen && <AppScreenCrop view={benefit.screen} className="attnd-mobile-benefit-screen" label={"Attnd App: " + benefit.title} />}</article>)}</div></section>
      <section className="attnd-mobile-start" id="mobile-start"><span className="attnd-mobile-kicker">BEREIT FÜR DEIN NÄCHSTES EVENT?</span><h2>Aus einer Idee<br />wird <em>ein Erlebnis.</em></h2><p>Erstelle dein Event in Attnd und bring Menschen zusammen.</p><div className="attnd-mobile-store-badges" aria-label="App herunterladen"><a href="/onboarding" aria-label="Im App Store laden"><b className="store-apple"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.27 3.57c.76-.97 1.34-2.34 1.13-3.57-1.25.09-2.71.88-3.56 1.9-.77.93-1.41 2.31-1.16 3.48 1.37.04 2.77-.77 3.59-1.81ZM24 17.53c-.55 1.24-.81 1.79-1.51 2.89-.98 1.54-2.36 3.46-4.07 3.48-1.52.02-1.91-1.02-3.97-1-2.06.01-2.49 1.02-4.01 1-1.71-.02-3.02-1.75-4-3.29C3.7 16.3 3.42 11.26 5.1 8.42c1.19-2.02 3.07-3.2 4.84-3.2 1.8 0 2.93 1.03 4.42 1.03 1.44 0 2.32-1.03 4.4-1.03 1.57 0 3.24.85 4.43 2.32-3.89 2.13-3.26 7.68.81 9.99Z" /></svg></b><span><small>Download on the</small>App Store</span></a><a href="/onboarding" aria-label="Bei Google Play laden"><b>▶</b><span><small>GET IT ON</small>Google Play</span></a></div></section>
    </main>
    <footer className="attnd-mobile-footer"><a href="#mobile-top" aria-label="Zurück zum Anfang"><Image src="/brand/attnd-logo-serif-white.png" alt="attnd" width={1774} height={887} /></a><span>Made for real life.</span><nav aria-label="Rechtliches"><Link href="/legal">Kontakt</Link><Link href="/privacy">Datenschutz</Link><Link href="/terms">AGB</Link><Link href="/refunds">Erstattungen</Link></nav><small>© {new Date().getFullYear()} Attnd</small></footer>
  </div></div><MarketingLanguageToggle /></>;
}
