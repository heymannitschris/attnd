type IconName = "pin" | "chevron" | "search" | "bell" | "heart" | "x" | "arrow" | "arrow-solid" | "calendar" | "clock" | "users" | "share" | "music" | "flame" | "leaf" | "check" | "ticket" | "info" | "invite" | "shield" | "send" | "lock" | "gift" | "trophy" | "sliders" | "navigation" | "locate" | "layers" | "camera" | "eye" | "edit";

export function DiscoverIcon({ name, className = "h-5 w-5", filled = false }: { name: IconName; className?: string; filled?: boolean }) {
  const path = {
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    share: <><path d="M12 15V3m-4 4 4-4 4 4M7 10H4v11h16V10h-3" /></>,
    music: <><path d="M9 18V5l12-2v13M9 9l12-2" /><ellipse cx="5.5" cy="18" rx="3.5" ry="3" /><ellipse cx="17.5" cy="16" rx="3.5" ry="3" /></>,
    flame: <path d="M13 2c1 6-5 6-3 11 2-1 3-3 3-5 5 3 7 6 6 10-1 3-4 4-7 4-5 0-8-3-7-8 0-3 2-5 3-6-1 4 0 5 1 6-1-5 5-7 4-12Z" />,
    leaf: <><path d="M21 3C8 2 2 8 4 16c8 5 17-1 17-13Z" /><path d="M3 21 16 8" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    ticket: <><path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Z" /><path d="M15 5v3m0 3v2m0 3v3" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.01" /></>,
    invite: <><circle cx="9" cy="7" r="3" /><path d="M2 21v-2a7 7 0 0 1 14 0v2M19 7v6m-3-3h6" /></>,
    shield: <><path d="M12 2 3.5 5v7c0 5 3.5 8 8.5 10 5-2 8.5-5 8.5-10V5L12 2Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    send: <><path d="m21 3-9.5 18-2.4-7.9L2 10.5 21 3Z" /><path d="m9.1 13.1 5.7-5.7" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
    gift: <><rect x="3" y="9" width="18" height="12" rx="2" /><path d="M12 9v12M3 13h18M12 9H7.5a2.5 2.5 0 1 1 2-4C11 6 12 9 12 9Zm0 0h4.5a2.5 2.5 0 1 0-2-4C13 6 12 9 12 9Z" /></>,
    trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 13v4m-4 3h8m-6-3h4" /></>,
    sliders: <><path d="M4 6h5m4 0h7M4 12h10m4 0h2M4 18h2m4 0h10" /><circle cx="11" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="8" cy="18" r="2" /></>,
    navigation: <path d="m4 11 16-7-7 16-2.2-6.8L4 11Z" />,
    locate: <><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    camera: <><path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10H2V9a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="4" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
    heart: <path d="M20.8 8.4c0 4.1-5.1 8.2-8.8 11.1C8.3 16.6 3.2 12.5 3.2 8.4a4.8 4.8 0 0 1 8.8-2.6 4.8 4.8 0 0 1 8.8 2.6Z" />,
    x: <path d="M5 5 19 19M19 5 5 19" />,
    arrow: <><path d="M4 12h16m-7-7 7 7-7 7" /></>,
    "arrow-solid": <path d="M13 3.5 21.5 12 13 20.5v-5.2H2.5V8.7H13V3.5Z" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 5.5a3 3 0 0 1 0 5.5M17 14a5.5 5.5 0 0 1 4.5 6" /></>,
  } satisfies Record<IconName, React.ReactNode>;

  return <svg aria-hidden="true" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{path[name]}</svg>;
}
