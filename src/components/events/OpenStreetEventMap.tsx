"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import type { ExploreEvent } from "@/types/explore";
import { DiscoverIcon } from "./DiscoverIcon";

const INITIAL_CENTER = { lat: 9.725, lon: 100.01 };

export function OpenStreetEventMap({ events, selectedId, onSelect, onVisibleEventsChange, onSelectedPointChange }: {
  events: readonly ExploreEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onVisibleEventsChange: (ids: string[]) => void;
  onSelectedPointChange?: (point: { x: number; y: number } | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const selectRef = useRef(onSelect);
  const visibleRef = useRef(onVisibleEventsChange);
  const eventsRef = useRef(events);
  const selectedIdRef = useRef(selectedId);
  const pointChangeRef = useRef(onSelectedPointChange);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { visibleRef.current = onVisibleEventsChange; }, [onVisibleEventsChange]);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { pointChangeRef.current = onSelectedPointChange; }, [onSelectedPointChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    const markers = markersRef.current;
    let cancelled = false;
    let observer: ResizeObserver | undefined;

    void import("leaflet").then((L) => {
      if (cancelled) return;
      const map = L.map(container, { attributionControl: true, zoomControl: false, minZoom: 9, maxZoom: 18 }).setView([INITIAL_CENTER.lat, INITIAL_CENTER.lon], 12);
      L.tileLayer("https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO',
        maxZoom: 19,
        crossOrigin: true,
      }).addTo(map);

      const updateVisibleEvents = () => {
        const bounds = map.getBounds().pad(0.08);
        visibleRef.current(eventsRef.current.filter((event) => bounds.contains([event.location.lat, event.location.lon])).map((event) => event.id));
      };
      const updateSelectedPoint = () => {
        const selected = eventsRef.current.find((event) => event.id === selectedIdRef.current);
        if (!selected) return pointChangeRef.current?.(null);
        const point = map.latLngToContainerPoint([selected.location.lat, selected.location.lon]);
        pointChangeRef.current?.({ x: point.x, y: point.y });
      };
      map.on("click", () => selectRef.current(null));
      map.on("moveend zoomend", updateVisibleEvents);
      map.on("move zoom", updateSelectedPoint);
      mapRef.current = map;
      setMapReady(true);
      observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      observer.observe(container);
      window.setTimeout(() => { map.invalidateSize({ pan: false }); updateVisibleEvents(); updateSelectedPoint(); }, 0);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      events.forEach((event) => {
        const selected = selectedId === event.id;
        const marker = L.marker([event.location.lat, event.location.lon], {
          title: event.title,
          keyboard: true,
          icon: L.divIcon({
            className: `explore-event-marker${selected ? " is-selected" : ""}`,
            html: "<span></span>",
            iconSize: selected ? [34, 34] : [24, 24],
            iconAnchor: selected ? [17, 17] : [12, 12],
          }),
        });
        marker.on("add", () => marker.getElement()?.style.setProperty("--marker-color", event.marker.color));
        marker.on("click", (leafletEvent) => {
          L.DomEvent.stopPropagation(leafletEvent);
          selectRef.current(event.id);
          map.panTo(marker.getLatLng(), { animate: true });
        });
        marker.addTo(map);
        markersRef.current.set(event.id, marker);
      });
      const selected = events.find((event) => event.id === selectedId);
      if (selected) {
        const point = map.latLngToContainerPoint([selected.location.lat, selected.location.lon]);
        pointChangeRef.current?.({ x: point.x, y: point.y });
      } else pointChangeRef.current?.(null);
    });
    return () => { cancelled = true; };
  }, [events, selectedId, mapReady]);

  const useCurrentLocation = () => {
    const map = mapRef.current;
    if (!map) return;
    if (!navigator.geolocation) return map.setView([INITIAL_CENTER.lat, INITIAL_CENTER.lon], 12);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => map.setView([coords.latitude, coords.longitude], 14, { animate: true }),
      () => map.setView([INITIAL_CENTER.lat, INITIAL_CENTER.lon], 12, { animate: true }),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  };

  return <div className="osm-map-shell">
    <div ref={containerRef} className="osm-event-map" aria-label="Interactive OpenStreetMap showing nearby events" />
    <div className="explore-map-tools">
      <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>+</button>
      <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>−</button>
      <button type="button" aria-label="Use current location" onClick={useCurrentLocation}><DiscoverIcon name="locate" /></button>
    </div>
  </div>;
}
