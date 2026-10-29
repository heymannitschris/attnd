export const primaryNavigation = [
  { label: "Discover", href: "/discover", icon: "discover" },
  { label: "Explore", href: "/explore", icon: "explore" },
  { label: "Saved", href: "/profile/saved", icon: "go" },
  { label: "Tickets", href: "/tickets", icon: "tickets" },
  { label: "Create", href: "/create", icon: "create" },
  { label: "Profile", href: "/profile", icon: "profile" },
] as const;

export type NavigationIcon = (typeof primaryNavigation)[number]["icon"];
