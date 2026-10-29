"use client";

import { useEffect, useRef, useState } from "react";

export type AppScreenView = "discover" | "dashboard" | "checkin" | "cohosts" | "team" | "affiliates" | "guestlist" | "locals" | "event";

/**
 * A live, non-interactive view of a complete Attnd app screen (rendered at
 * 390 × 844px and scaled to the container width), including its footer menu.
 */
export function AppScreenCrop({ view, className = "", label }: { view: AppScreenView; className?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => { const w = el.clientWidth; if (w > 0) setScale(w / 390); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref} className={"app-screen-crop " + className} aria-label={label} role="img">
    <span className="app-screen-crop-island" aria-hidden="true" />
    <iframe title={label} src={"/marketing-preview?context=feature&view=" + view + (view === "discover" ? "&demo=swipe" : "")} loading="lazy" tabIndex={-1} aria-hidden="true" style={{ transform: `scale(${scale})` }} />
  </div>;
}
