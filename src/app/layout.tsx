import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { SavedEventsProvider } from "@/components/events/SavedEventsProvider";
import { AuthGateProvider } from "@/components/auth/AuthGateProvider";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.attnd.space"),
  title: "Attnd",
  description: "Discover events around the world.",
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
  return <html lang="en"><body><AuthGateProvider><SavedEventsProvider><AppShell>{children}</AppShell></SavedEventsProvider></AuthGateProvider></body></html>;
}
