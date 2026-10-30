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
    const supabase = createClient();
    let cancelled = false;
    let loadedFor: string | null | undefined;
    // Load saved events for the current session and reload whenever the
    // session changes (fresh login, logout, token restored after cold start).
    // A one-shot load on mount missed saves when the user logged in later.
    async function load(userId: string | null) {
      if (userId === loadedFor) return;
      loadedFor = userId;
      if (!userId) { window.localStorage.removeItem("attnd:user-id"); setSavedIds(new Set()); return; }
      window.localStorage.setItem("attnd:user-id", userId);
      const response = await fetch("/api/saved-events", { cache: "no-store", credentials: "same-origin" });
      const result = await response.json() as { saved?: string[] };
      if (!cancelled && response.ok && loadedFor === userId) setSavedIds(new Set(result.saved || []));
    }
    void supabase.auth.getUser().then(({ data }) => load(data.user?.id ?? null)).catch(() => {});
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        void load(session?.user?.id ?? null).catch(() => {});
      }
    });
    return () => { cancelled = true; subscription.subscription.unsubscribe(); };
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
