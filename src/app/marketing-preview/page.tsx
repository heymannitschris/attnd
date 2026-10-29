import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CheckInDashboard, CohostDashboardPreview, EventAffiliatesDashboard, GuestlistDashboardPreview, LocalMembershipDashboardPreview, ManageEventDashboard, TeamDashboardPreview } from "@/components/dashboard/HostDashboardScreens";
import { DiscoverExperience } from "@/components/events/DiscoverExperience";
import { EventDetailsScreen } from "@/components/events/EventDetailsScreen";
import { mockEventDetails } from "@/lib/mock-event-details";
import { mockEvents } from "@/lib/mock-events";

export const metadata: Metadata = { title: "App-Vorschau | Attnd", robots: { index: false, follow: false } };

function PreviewCanvas({ children, feature = false }: { children: ReactNode; feature?: boolean }) {
  if (!feature) return <>{children}</>;
  return <div className="marketing-preview-canvas is-feature-preview">{children}</div>;
}

export default async function MarketingPreviewPage({ searchParams }: { searchParams: Promise<{ view?: string; demo?: string; context?: string }> }) {
  const { view, demo, context } = await searchParams;
  const feature = context === "feature";
  const discoverEvents = demo === "hero" ? [mockEvents[1], mockEvents[0], ...mockEvents.slice(2)] : mockEvents;
  if (view === "discover") return <PreviewCanvas feature={feature}><DiscoverExperience initialEvents={discoverEvents} autoDemo={demo === "swipe"} /></PreviewCanvas>;
  // The QR-Check-in feature card must show the SCANNER screen, not the
  // attendee list (Chris 2026-09-23 "hier den checkin screen anzeigen").
  if (view === "checkin") return <PreviewCanvas feature={feature}><CheckInDashboard previewCameraActive /></PreviewCanvas>;
  if (view === "cohosts") return <PreviewCanvas feature={feature}><CohostDashboardPreview /></PreviewCanvas>;
  if (view === "team") return <PreviewCanvas feature={feature}><TeamDashboardPreview /></PreviewCanvas>;
  if (view === "affiliates") return <PreviewCanvas feature={feature}><EventAffiliatesDashboard /></PreviewCanvas>;
  if (view === "guestlist") return <PreviewCanvas feature={feature}><GuestlistDashboardPreview /></PreviewCanvas>;
  if (view === "locals") return <PreviewCanvas feature={feature}><LocalMembershipDashboardPreview /></PreviewCanvas>;
  if (view === "event") {
    const event = mockEvents.find((item) => item.id === "jungle-experience")!;
    const details = mockEventDetails.find((item) => item.eventId === event.id)!;
    return <PreviewCanvas feature={feature}><EventDetailsScreen event={event} details={details} databaseEventId={event.id} /></PreviewCanvas>;
  }
  return <PreviewCanvas feature={feature}><ManageEventDashboard /></PreviewCanvas>;
}
