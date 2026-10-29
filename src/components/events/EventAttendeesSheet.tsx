"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import type { EventPerson } from "@/types/event";
import { DiscoverIcon } from "./DiscoverIcon";
import { useFollowing } from "@/components/profile/FollowingProvider";

export function EventAttendeesSheet({ open, onClose, onInvite, total, attendees }: { open: boolean; onClose: () => void; onInvite: () => void; total: number; attendees: readonly EventPerson[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const dragRef = useRef<{ y: number; pointerId: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const { isFollowing, toggleFollowing } = useFollowing();
  const visible = expanded ? attendees : attendees.slice(0, 6);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const scrollY = window.scrollY;
    const previous = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = previous.overflow;
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  function closeSheet() {
    setDragOffset(0);
    setDragging(false);
    onClose();
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a")) return;
    dragRef.current = { y: event.clientY, pointerId: event.pointerId };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDragOffset(Math.max(0, event.clientY - drag.y));
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const distance = dragOffset;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (distance > 78) closeSheet();
    else setDragOffset(0);
  }

  return <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={closeSheet} onClose={closeSheet} onClick={(event) => { if (event.target === event.currentTarget) closeSheet(); }} className={`event-attendees-sheet${dragging ? " is-dragging" : ""}`} style={{ "--sheet-drag-y": `${dragOffset}px` } as React.CSSProperties}>
    <div className="event-attendees-inner">
      <div className="event-attendees-drag-zone" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
        <div className="event-attendees-handle" />
        <header className="event-attendees-header"><div><h2 id={titleId}>{total} people are going</h2><p>Connect, invite friends and meet amazing people</p></div><button type="button" onClick={closeSheet} aria-label="Close attendees"><DiscoverIcon name="x" /></button></header>
      </div>
      <div className="event-attendees-summary"><span className="event-attendees-stack">{attendees.slice(0, 5).map((person) => <Avatar key={person.id} name={person.name} portrait={person.portrait} avatarUrl={person.avatarUrl} size={38} />)}{total > 5 && <span>+{total - 5}</span>}</span><button type="button" className="event-attendees-invite" onClick={onInvite}><DiscoverIcon name="invite" />Invite Friends</button></div>
      <div className="event-attendees-list">{visible.map((person) => <div key={person.id} className="event-attendee-row"><Link href={`/people/${person.id}`} onClick={onClose} className="event-attendee-profile"><span className="event-attendee-portrait"><Avatar name={person.name} portrait={person.portrait} avatarUrl={person.avatarUrl} size={39} /><span /></span><span className="event-attendee-text"><strong>{person.name}</strong><small>{person.location || "Attnd member"}</small></span><DiscoverIcon name="chevron" /></Link><button type="button" aria-pressed={isFollowing(person.id)} onClick={() => void toggleFollowing(person.id)} className="event-attendee-follow">{isFollowing(person.id) && <DiscoverIcon name="check" />}{isFollowing(person.id) ? "Following" : "Follow"}</button></div>)}</div>
      {!attendees.length && <div className="event-attendees-empty"><DiscoverIcon name="users" /><strong>No public guests yet</strong><span>Attendees appear here when they choose to share their attendance.</span></div>}
      {attendees.length > 6 && <button type="button" onClick={() => setExpanded(!expanded)} className="event-attendees-see-all"><DiscoverIcon name="users" />{expanded ? "Show fewer people" : `See all ${attendees.length} people`}<DiscoverIcon name="chevron" /></button>}
    </div>
  </dialog>;
}
