"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";
import { IconButton } from "./IconButton";

export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else dialog.close();
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  return <dialog ref={ref} aria-labelledby={titleId} className="bottom-sheet" onCancel={onClose} onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="p-5 sm:p-6">
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
      <header className="mb-5 flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-xl font-semibold">{title}</h2>
        <IconButton label="Close" onClick={onClose}><DiscoverIcon name="x" /></IconButton>
      </header>
      {children}
    </div>
  </dialog>;
}
