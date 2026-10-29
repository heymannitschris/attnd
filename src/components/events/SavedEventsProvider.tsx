"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import { useAuthGate } from "@/components/auth/AuthGateProvider";

const SavedEventsContext = createContext<{ savedIds: ReadonlySet<string>; toggleSaved: (id: string) => Promise<boolean> } | null>(null);

export function SavedEventsProvider({ children }: { children: ReactNode }) {
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(() => new Set());
  const { requireAuth } = useAuthGate();
  useEffect(() => {
    if (!hasSupabaseConfig) return;
    void createClient().auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.localStorage.removeItem("attnd:user-id"); setSavedIds(new Set()); return; }
      window.localStorage.setItem("attnd:user-id", data.user.id);
      const response = await fetch("/api/saved-events");
      const result = await response.json() as { saved?: string[] };
      if (response.ok) setSavedIds(new Set(result.saved || []));
    }).catch(() => {});
  }, []);
  async function toggleSaved(id: string) {
    if (!await requireAuth({ action: "Log in or create an account to save events." })) return false;
    const willSave = !savedIds.has(id);
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (hasSupabaseConfig) void fetch(willSave ? "/api/saved-events" : `/api/saved-events?eventRef=${encodeURIComponent(id)}`, {
      method: willSave ? "POST" : "DELETE",
      headers: willSave ? { "content-type": "application/json" } : undefined,
      body: willSave ? JSON.stringify({ eventRef: id }) : undefined,
    }).then((response) => { if (!response.ok) setSavedIds((current) => { const next = new Set(current); if (willSave) next.delete(id); else next.add(id); return next; }); }).catch(() => {
      setSavedIds((current) => { const next = new Set(current); if (willSave) next.delete(id); else next.add(id); return next; });
    });
    return true;
  }
  return <SavedEventsContext.Provider value={{ savedIds, toggleSaved }}>{children}</SavedEventsContext.Provider>;
}

export function useSavedEvents() {
  const context = useContext(SavedEventsContext);
  if (!context) throw new Error("useSavedEvents requires SavedEventsProvider");
  return context;
}
