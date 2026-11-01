import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { SavedEventsProvider } from "@/components/events/SavedEventsProvider";
import { AuthGateProvider } from "@/components/auth/AuthGateProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo/site";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "attnd – Events auf Koh Phangan & mehr", template: "%s | attnd" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "./" },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "de_DE", url: "./", title: "attnd – Events auf Koh Phangan & mehr", description: SITE_DESCRIPTION },
  twitter: { card: "summary_large_image", title: "attnd – Events auf Koh Phangan & mehr", description: SITE_DESCRIPTION },
};

const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/brand/attnd-icon.png` },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: SITE_NAME, url: SITE_URL, inLanguage: "de", description: SITE_DESCRIPTION, publisher: { "@id": `${SITE_URL}/#organization` } },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body><JsonLd data={siteJsonLd} /><AuthGateProvider><SavedEventsProvider><AppShell>{children}</AppShell></SavedEventsProvider></AuthGateProvider></body></html>;
}
