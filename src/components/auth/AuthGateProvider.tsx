"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

type AuthRequest = { action?: string; next?: string };
type AuthGateContextValue = { requireAuth: (request?: AuthRequest) => Promise<boolean> };

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

function safeNextPath(path?: string) {
  if (path?.startsWith("/") && !path.startsWith("//")) return path;
  if (typeof window !== "undefined") return `${window.location.pathname}${window.location.search}`;
  return "/discover";
}

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<AuthRequest | null>(null);

  const requireAuth = useCallback(async (nextRequest: AuthRequest = {}) => {
    if (hasSupabaseConfig) {
      try {
        const { data } = await createClient().auth.getUser();
        if (data.user) return true;
      } catch {
        // The sign-in prompt is also the safe fallback for an unavailable session.
      }
    }
    setRequest({ ...nextRequest, next: safeNextPath(nextRequest.next) });
    return false;
  }, []);

  const value = useMemo(() => ({ requireAuth }), [requireAuth]);
  const next = request?.next || "/discover";
  const loginHref = `/onboarding?mode=login&next=${encodeURIComponent(next)}`;
  const signupHref = `/onboarding?mode=signup&next=${encodeURIComponent(next)}`;

  return <AuthGateContext.Provider value={value}>
    {children}
    <BottomSheet open={Boolean(request)} onClose={() => setRequest(null)} title="Join Attnd to continue">
      <div className="auth-gate-content">
        <span className="auth-gate-icon"><DiscoverIcon name="users" /></span>
        <p>{request?.action || "Log in or create an account to use this feature."}</p>
        <div className="auth-gate-actions">
          <Link href={loginHref}>Log in</Link>
          <Link href={signupHref}>Create account</Link>
        </div>
      </div>
    </BottomSheet>
  </AuthGateContext.Provider>;
}

export function useAuthGate() {
  const context = useContext(AuthGateContext);
  if (!context) throw new Error("useAuthGate must be used inside AuthGateProvider");
  return context;
}
