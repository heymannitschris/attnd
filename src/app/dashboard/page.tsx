import type { Metadata } from "next";
import { HostDashboardOverview } from "@/components/dashboard/HostDashboardScreens";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Host Dashboard | Attnd" };
export default async function HostDashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const requested = (await searchParams).tab ?? "Overview";
  const normalized = requested.toLowerCase().replaceAll("-", " ");
  const initialTab = ["Overview", "Events", "Earnings", "Co-Hosting", "Team", "Check-in Team", "Guestlist", "Local Membership", "Waitlist & Refunds", "Tools"].find((item) => item.toLowerCase().replaceAll("-", " ") === normalized) ?? "Overview";
  let hostEvents: Array<{ id: string; slug: string; title: string; status: string; startsAt: string | null; image: string | null }> = [];
  if (hasSupabaseConfig) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("events").select("id, slug, title, status, starts_at, cover_url").eq("host_id", user.id).order("created_at", { ascending: false });
      hostEvents = (data ?? []).map((event) => ({ id: event.id, slug: event.slug, title: event.title, status: event.status, startsAt: event.starts_at, image: event.cover_url }));
    }
  }
  return <HostDashboardOverview initialTab={initialTab} hostEvents={hostEvents} />;
}
