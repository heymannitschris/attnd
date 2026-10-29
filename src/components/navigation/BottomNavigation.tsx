"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNavigation, type NavigationIcon } from "@/config/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

const paths: Record<NavigationIcon, ReactNode> = {
  discover: <><circle cx="12" cy="12" r="9" /><path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5 5.5-2.1Z" /></>,
  explore: <><circle cx="10.5" cy="10.5" r="7.5" /><path d="m16 16 5 5" /></>,
  go: <path d="M20.8 8.4c0 4.1-5.1 8.2-8.8 11.1C8.3 16.6 3.2 12.5 3.2 8.4a4.8 4.8 0 0 1 8.8-2.6 4.8 4.8 0 0 1 8.8 2.6Z" />,
  create: <path d="M12 4v16M4 12h16" />,
  tickets: <><path d="M4 7.5A2.5 2.5 0 0 0 6.5 5h11A2.5 2.5 0 0 0 20 7.5v2a2.5 2.5 0 0 0 0 5v2A2.5 2.5 0 0 0 17.5 19h-11A2.5 2.5 0 0 0 4 16.5v-2a2.5 2.5 0 0 0 0-5v-2Z" /><path d="M12 7v2m0 2v2m0 2v2" /></>,
  profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
};

export function BottomNavigation() {
  const pathname = usePathname();
  const activePath = pathname.endsWith("/checkout/success") ? "/tickets" : pathname;
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    let active = true;
    const supabase = createClient();
    const loadProfile = async (userId?: string, metadataAvatar?: string | null) => {
      if (!active) return;
      if (!userId) {
        setSignedIn(false);
        setProfileImage(null);
        return;
      }
      setSignedIn(true);
      const { data } = await supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
      if (active) setProfileImage(data?.avatar_url || metadataAvatar || null);
    };
    void supabase.auth.getUser().then(({ data }) => void loadProfile(data.user?.id, data.user?.user_metadata?.avatar_url));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadProfile(session?.user.id, session?.user.user_metadata?.avatar_url);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <nav aria-label="Primary navigation" className="bottom-navigation fixed inset-x-0 bottom-0 mx-auto max-w-2xl" style={{ zIndex: "var(--z-navigation)" }}>
      <div className="navigation-items relative grid grid-cols-6 px-2 sm:px-6">
        {primaryNavigation.map(({ label, href, icon }) => {
          const active = icon === "profile"
            ? (activePath === "/profile" || (activePath.startsWith("/profile/") && !activePath.startsWith("/profile/saved")))
            : activePath === href || activePath.startsWith(`${href}/`);
          const showProfilePhoto = icon === "profile" && signedIn;
          return (
            <Link key={href} href={href} prefetch data-nav-item={icon} aria-current={active ? "page" : undefined} aria-label={showProfilePhoto ? "Profile" : undefined} className={`navigation-item flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-xl text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent${showProfilePhoto ? " is-profile-photo" : ""}`}>
              {showProfilePhoto ? <span className="navigation-profile-avatar">{profileImage && <Image src={profileImage} alt="Your profile" width={40} height={40} className="navigation-profile-image" unoptimized={profileImage.startsWith("http")} />}</span> : <>
                <span className={icon === "create" ? "navigation-icon navigation-create" : "navigation-icon"}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">{paths[icon]}</svg>
                </span>
                <span>{label}</span>
              </>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
