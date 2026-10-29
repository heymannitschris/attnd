import type { Metadata, Viewport } from "next";
import { OnboardingExperience } from "@/components/onboarding/OnboardingExperience";

export const metadata: Metadata = { title: "Welcome | Attnd" };
export const viewport: Viewport = { themeColor: "#000000", viewportFit: "cover" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const { next, mode } = await searchParams;
  const hasReturnPath = Boolean(next?.startsWith("/") && !next.startsWith("//"));
  return <OnboardingExperience initialAuthScreen={mode === "signup" ? "signup" : hasReturnPath || mode === "login" ? "login" : undefined} />;
}
