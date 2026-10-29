"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DiscoveryEvent } from "@/types/event";
import { DiscoverIcon } from "./DiscoverIcon";

type GalleryItem = { src: string; alt: string; kind?: "photo" | "video" };

export function EventCard({ event, gallery = [], onOpenDetails }: { event: DiscoveryEvent; gallery?: readonly GalleryItem[]; onOpenDetails?: () => void }) {
  const slides = useMemo(() => {
    return gallery.length ? [...gallery] : [{ src: event.image, alt: event.imageAlt }];
  }, [event.image, event.imageAlt, gallery]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [videoMuted, setVideoMuted] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { setSlideIndex(0); setVideoMuted(true); setVideoReady(false); }, [event.id]);
  const slide = slides[slideIndex] || slides[0];
  const moveSlide = (direction: -1 | 1) => { setVideoReady(false); setSlideIndex((current) => (current + direction + slides.length) % slides.length); };
  const toggleVideoSound = () => {
    const muted = !videoMuted;
    setVideoMuted(muted);
    if (videoRef.current) {
      videoRef.current.muted = muted;
      videoRef.current.volume = 1;
      if (!muted) void videoRef.current.play().catch(() => undefined);
    }
  };
  return (
    <article className="discover-event-card relative isolate flex h-full flex-col justify-end overflow-hidden rounded-[1.25rem] border border-white/15 bg-surface shadow-[var(--shadow-card)]">
      {slide.kind === "video" ? <video ref={videoRef} key={slide.src} src={slide.src} aria-label={slide.alt} className="discover-event-slide -z-20 object-cover" muted={videoMuted} playsInline autoPlay loop preload="auto" onLoadedData={() => setVideoReady(true)} onPlaying={() => setVideoReady(true)} onWaiting={() => setVideoReady(false)} onCanPlay={(event) => void event.currentTarget.play().catch(() => undefined)} /> : <Image key={slide.src} src={slide.src} alt={slide.alt} fill priority draggable={false} sizes="(max-width: 672px) 100vw, 672px" className="discover-event-slide -z-20 object-cover" />}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/35 via-transparent via-35% to-black/95" />

      {slide.kind === "video" && !videoReady && <div className="discover-video-loading" role="status" aria-label="Loading video"><i /></div>}

      {slide.kind === "video" && <button type="button" className="discover-video-sound" aria-label={videoMuted ? "Turn video sound on" : "Mute video"} aria-pressed={!videoMuted} onClick={toggleVideoSound}><span aria-hidden="true">{videoMuted ? "🔇" : "🔊"}</span>{videoMuted ? "Sound" : "On"}</button>}

      <div className="discover-gallery-progress" aria-label={`Gallery item ${slideIndex + 1} of ${slides.length}`}>{slides.map((item, index) => <i key={`${item.src}-${index}`} data-active={index === slideIndex} />)}</div>
      {slides.length > 1 && <div className="discover-gallery-taps"><button type="button" aria-label="Previous event photo" onClick={() => moveSlide(-1)} /><button type="button" aria-label="Next event photo" onClick={() => moveSlide(1)} /></div>}

      <div className="discover-event-details relative z-[2] space-y-2.5 p-4 text-white sm:space-y-3 sm:p-6">
        <p className="text-xs font-semibold tracking-normal uppercase sm:text-sm">{event.date.replace("Saturday", "Sat").replace("Sunday", "Sun").replace("Friday", "Fri")} · {event.time}</p>
        <div>
          <h2 className="text-[clamp(1.5rem,7.05vw,2.75rem)] font-bold">{event.title}</h2>
          <p className="mt-1.5 truncate text-[13px] text-white/80 sm:text-base">{event.tags.join(" · ")}</p>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-white/85 sm:text-sm">
          <span className="inline-flex min-w-0 items-center gap-2 truncate"><DiscoverIcon name="pin" className="h-4 w-4 shrink-0" /><span className="truncate">{event.location}</span></span>
          {event.distance && <span className="shrink-0">{event.distance.replace(" away", "")}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/80 sm:text-sm">
          <DiscoverIcon name="users" className="h-5 w-5" />
          <span>{event.attendeeCount} people are going</span>
          <DiscoverIcon name="chevron" className="h-3.5 w-3.5 -rotate-90" />
        </div>
        <div className="flex items-end justify-between gap-3 pt-1">
          <div className="flex items-baseline gap-1 text-white">{event.price !== "Free" && <span className="text-sm font-medium">From</span>}<strong className="text-[26px] font-bold tracking-tight">{event.price.replace("From ", "")}</strong></div>
          <button type="button" onClick={onOpenDetails} aria-label={`Open ${event.title} details`} className="discover-open-event"><DiscoverIcon name="arrow-solid" filled /></button>
        </div>
      </div>
    </article>
  );
}
