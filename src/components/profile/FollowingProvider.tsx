"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

const storageKey = "attnd:following";
const uuid = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
type FollowingContextValue = { isFollowing: (profileId: string) => boolean; toggleFollowing: (profileId: string) => Promise<void> };
const FollowingContext = createContext<FollowingContextValue | null>(null);

export function FollowingProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  const { requireAuth } = useAuthGate();

  useEffect(() => {
    let active = true;
    void (async () => {
      if (hasSupabaseConfig) {
        const { data } = await createClient().auth.getUser();
        if (!active) return;
        if (!data.user) { setIds(new Set()); window.localStorage.removeItem(storageKey); return; }
      }
      let local = new Set<string>();
      try { local = new Set(JSON.parse(window.localStorage.getItem(storageKey) || "[]") as string[]); } catch { local = new Set(); }
      if (active) setIds(local);
      const response = await fetch("/api/follows", { cache: "no-store" });
      const result = response.ok ? await response.json() as { following?: string[] } : null;
      if (!active || !result?.following) return;
      const next = new Set([...local].filter((id) => !uuid.test(id)));
      result.following.forEach((id) => next.add(id));
      setIds(next); window.localStorage.setItem(storageKey, JSON.stringify([...next]));
    })().catch(() => {});
    const sync = (event: StorageEvent) => { if (event.key === storageKey && event.newValue) try { setIds(new Set(JSON.parse(event.newValue) as string[])); } catch { /* Ignore malformed data from another tab. */ } };
    window.addEventListener("storage", sync);
    return () => { active = false; window.removeEventListener("storage", sync); };
  }, []);

  const toggleFollowing = useCallback(async (profileId: string) => {
    if (!await requireAuth({ action: "Log in or create an account to follow people." })) return;
    const wasFollowing = ids.has(profileId);
    const optimistic = new Set(ids);
    if (wasFollowing) optimistic.delete(profileId); else optimistic.add(profileId);
    setIds(optimistic); window.localStorage.setItem(storageKey, JSON.stringify([...optimistic]));
    if (!uuid.test(profileId)) return;
    try {
      const response = await fetch(wasFollowing ? `/api/follows?profileId=${encodeURIComponent(profileId)}` : "/api/follows", wasFollowing ? { method: "DELETE" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profileId }) });
      if (!response.ok) throw new Error("Follow update failed");
    } catch {
      setIds(ids); window.localStorage.setItem(storageKey, JSON.stringify([...ids]));
    }
  }, [ids, requireAuth]);

  const value = useMemo(() => ({ isFollowing: (profileId: string) => ids.has(profileId), toggleFollowing }), [ids, toggleFollowing]);
  return <FollowingContext.Provider value={value}>{children}</FollowingContext.Provider>;
}

export function useFollowing() {
  const context = useContext(FollowingContext);
  if (!context) throw new Error("useFollowing must be used inside FollowingProvider");
  return context;
}
