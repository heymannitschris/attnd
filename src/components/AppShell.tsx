"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { MobileContainer } from "@/components/MobileContainer";
import { AppLanguageProvider } from "@/components/i18n/AppLanguageProvider";
import { FollowingProvider } from "@/components/profile/FollowingProvider";

const DesktopMarketingSite = dynamic(() => import("@/components/marketing/MarketingSite").then((module) => module.MarketingSite), { ssr: false });

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [showDesktopLanding, setShowDesktopLanding] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setShowDesktopLanding(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const isNativeIOS = /EventPlatform-iOS/i.test(window.navigator.userAgent);
    document.documentElement.classList.toggle("attnd-native-ios", isNativeIOS);
    return () => document.documentElement.classList.remove("attnd-native-ios");
  }, []);

  useEffect(() => {
    const affiliateId = new URLSearchParams(window.location.search).get("affiliate_id");
    if (!affiliateId || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(affiliateId)) return;
    const momentId = new URLSearchParams(window.location.search).get("moment") || undefined;
    const visitKey = `attnd:affiliate-visit:${affiliateId}:${pathname}:${momentId || "event"}`;
    if (window.sessionStorage.getItem(visitKey)) return;
    let visitorKey = window.localStorage.getItem("attnd:visitor-key");
    if (!visitorKey) { visitorKey = crypto.randomUUID(); window.localStorage.setItem("attnd:visitor-key", visitorKey); }
    const eventSlug = pathname.startsWith("/events/") ? pathname.split("/")[2] : undefined;
    void fetch("/api/affiliates/visit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ affiliateId, visitorKey, eventSlug, momentId }) }).then((response) => {
      if (response.ok) window.sessionStorage.setItem(visitKey, "1");
    }).catch(() => {});
  }, [pathname]);

  const isMarketingSite = pathname === "/";
  const isLegalPage = ["/terms", "/privacy", "/refunds", "/legal", "/support"].includes(pathname);
  const isOnboarding = pathname === "/onboarding";
  const isEventDetails = pathname.startsWith("/events/");
  const isHostProfile = pathname.startsWith("/hosts/");
  const isPersonProfile = pathname.startsWith("/people/");
  const isMarketingPreview = pathname === "/marketing-preview";
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isSuspended = pathname === "/account-suspended";

  if (isAdmin) {
    return <><>{children}</>{pathname !== "/admin/login" && <div className="admin-mobile-navigation"><BottomNavigation /></div>}</>;
  }

  if (isMarketingSite || isLegalPage || isSuspended) {
    return <>{children}</>;
  }

  if (isOnboarding) {
    return <AppLanguageProvider><div className="onboarding-desktop-shell"><MobileContainer><main id="main-content" className="min-h-dvh">{children}</main></MobileContainer></div></AppLanguageProvider>;
  }

  return (
    <>
      {!isMarketingPreview && showDesktopLanding && <div className="desktop-landing-only"><DesktopMarketingSite /></div>}
      <FollowingProvider><AppLanguageProvider preview={isMarketingPreview}><div className="app-mobile-only min-h-dvh bg-background">
          <MobileContainer>
            <main id="main-content" className={isOnboarding || isEventDetails || isHostProfile || isPersonProfile ? "min-h-dvh" : "min-h-dvh px-5 pt-10 pb-32 sm:px-8"}>{children}</main>
          </MobileContainer>
          {!isOnboarding && <BottomNavigation />}
        </div></AppLanguageProvider></FollowingProvider>
    </>
  );
}
