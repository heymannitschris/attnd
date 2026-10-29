"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

const locations: Record<string, { lat: number; lon: number; address: string }> = {
  "island-community-sunset": { lat: 9.7585, lon: 99.9636, address: "Zen Beach, Hin Kong, Koh Phangan, Surat Thani 84280, Thailand" },
  "sunset-breathwork": { lat: 9.7707, lon: 99.9656, address: "Secret Beach, 22/1 Moo 8, Srithanu, Koh Phangan, Surat Thani 84280, Thailand" },
  "jungle-experience": { lat: 9.7102, lon: 100.0118, address: "Jungle Experience, Baan Tai, Koh Phangan, Surat Thani 84280, Thailand" },
  "moonlight-beach": { lat: 9.6769, lon: 100.0661, address: "Haad Rin Beach, Ban Tai, Koh Phangan, Surat Thani 84280, Thailand" },
  "palm-grove-sessions": { lat: 9.7118, lon: 99.9863, address: "Thong Sala, Koh Phangan, Surat Thani 84280, Thailand" },
};

export function getEventAddress(eventId: string) {
  return locations[eventId] ?? locations["moonlight-beach"];
}

export function EventLocationMap({ eventId, title, location: providedLocation }: { eventId: string; title: string; location?: { lat: number; lon: number; address: string } }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    const location = providedLocation ?? getEventAddress(eventId);
    let cancelled = false;
    let observer: ResizeObserver | undefined;

    void import("leaflet").then((L) => {
      if (cancelled) return;
      const map = L.map(container, { attributionControl: true, zoomControl: true, minZoom: 9, maxZoom: 19 }).setView([location.lat, location.lon], 15);
      L.tileLayer("https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO',
        maxZoom: 19,
        crossOrigin: true,
      }).addTo(map);
      L.marker([location.lat, location.lon], {
        title,
        icon: L.divIcon({ className: "event-location-marker", html: "<span></span>", iconSize: [34, 42], iconAnchor: [17, 42] }),
      }).addTo(map);
      mapRef.current = map;
      observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      observer.observe(container);
      window.setTimeout(() => map.invalidateSize({ pan: false }), 0);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [eventId, title, providedLocation]);

  return <div ref={containerRef} className="event-location-osm" aria-label={`Interactive OpenStreetMap for ${title}`} />;
}
