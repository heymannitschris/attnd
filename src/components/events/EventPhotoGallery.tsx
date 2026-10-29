"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { EventDetails, EventGalleryCategory, EventGalleryPhoto, EventGalleryVideo } from "@/types/event";
import { DiscoverIcon } from "./DiscoverIcon";

type GalleryItem = ({ kind: "photo" } & EventGalleryPhoto) | ({ kind: "video" } & EventGalleryVideo);
type Filter = "All" | EventGalleryCategory;
const filters: readonly Filter[] = ["All", "UGC", "Venue", "People", "Atmosphere", "Location"];

export function EventPhotoGallery({ eventTitle, photos, video, uploadedMedia, index, onIndexChange, open, onClose }: {
  eventTitle: string;
  photos: EventDetails["photos"];
  video?: EventDetails["video"];
  uploadedMedia?: EventDetails["media"];
  index: number;
  onIndexChange: (index: number) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("All");
  const [liked, setLiked] = useState<ReadonlySet<string>>(new Set());
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoBySrc = new Map(photos.map((photo) => [photo.src, photo]));
  const media: GalleryItem[] = uploadedMedia?.length ? uploadedMedia.map((item): GalleryItem => {
    if (item.kind === "photo") {
      const photo = photoBySrc.get(item.src);
      return photo ? { ...photo, kind: "photo" } : { kind: "photo", src: item.src, alt: item.alt, title: item.alt, caption: item.description || "", category: item.category || "Atmosphere", likes: 0 };
    }
    return { kind: "video", src: item.src, poster: "", alt: item.alt, title: item.alt, caption: item.description || "", category: item.category || "Atmosphere", duration: "Video", durationSeconds: 0, frames: [], likes: 0 };
  }) : [
    ...(photos[0] ? [{ ...photos[0], kind: "photo" as const }] : []),
    ...(video ? [{ ...video, kind: "video" as const }] : []),
    ...photos.slice(1).map((photo) => ({ ...photo, kind: "photo" as const })),
  ];
  const selected = media[index] ?? media[0];
  const previewDuration = selected?.kind === "video" ? selected.durationSeconds : 0;
  const selectedKey = selected?.src ?? "";
  const selectedLiked = liked.has(selectedKey);
  const visibleMedia = filter === "All" ? media : media.filter((item) => filter === "Venue" ? item.category === "Venue" || item.category === "Stage" : item.category === filter);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    backRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { setFilter("All"); setPlaying(false); setElapsed(0); onClose(); }
      if (event.key === "ArrowLeft") onIndexChange((index - 1 + media.length) % media.length);
      if (event.key === "ArrowRight") onIndexChange((index + 1) % media.length);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [open, index, media.length, onIndexChange, onClose]);

  useEffect(() => {
    if (!open || !playing || !previewDuration) return;
    const timer = window.setInterval(() => setElapsed((value) => (value + 0.1) % previewDuration), 100);
    return () => window.clearInterval(timer);
  }, [open, playing, previewDuration]);

  if (!open || !selected) return null;

  function closeGallery() { setFilter("All"); setPlaying(false); setElapsed(0); onClose(); }

  function select(nextIndex: number) {
    setPlaying(false);
    setElapsed(0);
    onIndexChange((nextIndex + media.length) % media.length);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleLike() {
    setLiked((current) => {
      const next = new Set(current);
      if (next.has(selectedKey)) next.delete(selectedKey);
      else next.add(selectedKey);
      return next;
    });
  }

  async function enterFullscreen() {
    const videoElement = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (selected.kind === "video" && videoElement?.webkitEnterFullscreen) {
      videoElement.webkitEnterFullscreen();
      return;
    }
    const target = selected.kind === "video" ? videoElement : galleryRef.current;
    if (target?.requestFullscreen) await target.requestFullscreen();
  }

  return <div ref={galleryRef} role="dialog" aria-modal="true" aria-label={`${eventTitle} event gallery`} className="event-gallery-screen">
    <div ref={scrollRef} className="event-gallery-scroll">
      <section className="event-gallery-feature" aria-label={selected.title}>
        {selected.kind === "video"
          ? selected.frames.length ? <div className="absolute inset-0">
              <Image key={selected.frames[Math.min(Math.floor(elapsed / (selected.durationSeconds / selected.frames.length)), selected.frames.length - 1)]} src={selected.frames[Math.min(Math.floor(elapsed / (selected.durationSeconds / selected.frames.length)), selected.frames.length - 1)]} alt={selected.alt} fill priority sizes="(max-width: 672px) 100vw, 672px" className="event-cover-image object-cover" />
              <button type="button" aria-label={playing ? "Pause event preview" : "Play event preview"} onClick={() => setPlaying(!playing)} className="absolute inset-0 z-[1] flex items-center justify-center">{!playing && <span className="event-gallery-large-play">▶</span>}</button>
              <div className="absolute inset-x-5 bottom-2 z-20 flex items-center gap-2 text-[11px]">
                <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause event preview" : "Play event preview"} className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50">{playing ? "Ⅱ" : "▶"}</button>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/35"><div className="h-full bg-white" style={{ width: `${(elapsed / selected.durationSeconds) * 100}%` }} /></div>
                <span className="tabular-nums">0:{String(Math.floor(elapsed)).padStart(2, "0")} / {selected.duration}</span>
              </div>
            </div> : <video ref={videoRef} key={selected.src} src={selected.src} controls autoPlay muted loop playsInline preload="auto" className="event-gallery-video absolute inset-0 h-full w-full bg-black object-contain" />
          : <Image key={selected.src} src={selected.src} alt={selected.alt} fill priority sizes="(max-width: 672px) 100vw, 672px" className="object-cover" />}
        <div className="event-gallery-shade pointer-events-none absolute inset-0" />

        <header className="event-gallery-header absolute inset-x-0 top-0 z-10 grid items-center px-5 pt-[max(18px,var(--app-safe-area-top))]">
          <button ref={backRef} type="button" onClick={closeGallery} aria-label="Back to event" className="event-gallery-round-button"><DiscoverIcon name="chevron" className="h-5 w-5 rotate-90" /></button>
          <nav className="event-gallery-dots" aria-label={`Gallery item ${index + 1} of ${media.length}`}>
            {media.map((item, itemIndex) => <button key={item.src} type="button" aria-label={`Show gallery item ${itemIndex + 1}`} aria-current={itemIndex === index ? "true" : undefined} onClick={() => select(itemIndex)} />)}
          </nav>
          <button type="button" onClick={() => void enterFullscreen()} aria-label="Open fullscreen" className="event-gallery-round-button"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></svg></button>
        </header>

        <div className={`absolute inset-x-5 z-10 flex items-end justify-between gap-3 ${selected.kind === "video" ? "bottom-14" : "bottom-4"}`}>
          <div className="min-w-0"><p className="text-base font-semibold">{selected.title}</p><p className="truncate text-xs text-white/75">{selected.caption}</p></div>
          <button type="button" aria-label={selectedLiked ? "Unlike gallery item" : "Like gallery item"} aria-pressed={selectedLiked} onClick={toggleLike} className="event-gallery-like"><DiscoverIcon name="heart" filled={selectedLiked} className="h-5 w-5" /><span>{selected.likes + Number(selectedLiked)}</span></button>
        </div>
      </section>

      <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-white/20" />
      <nav aria-label="Filter gallery" className="event-gallery-filters">
        {filters.map((option) => <button key={option} type="button" aria-pressed={filter === option} onClick={() => setFilter(option)} className={`event-gallery-filter ${filter === option ? "is-selected" : ""}`}>{option}</button>)}
      </nav>
      <div className="grid grid-cols-3 gap-2 px-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        {visibleMedia.map((item) => {
          const mediaIndex = media.indexOf(item);
          return <button key={item.src} type="button" onClick={() => select(mediaIndex)} aria-label={`View ${item.title}`} aria-current={mediaIndex === index ? "true" : undefined} className={`event-gallery-thumbnail ${mediaIndex === index ? "is-current" : ""}`}>
            {item.kind === "video" ? item.poster ? <Image src={item.poster} alt={item.alt} fill sizes="(max-width: 672px) 33vw, 210px" className="object-cover" /> : <video src={item.src} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full bg-black object-cover" /> : <Image src={item.src} alt={item.alt} fill sizes="(max-width: 672px) 33vw, 210px" className="object-cover" />}
            {item.kind === "video" && <><span className="event-gallery-play">▶</span><span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">{item.duration}</span></>}
          </button>;
        })}
      </div>
    </div>
  </div>;
}
