import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/seo/site";

export const revalidate = 3600;

const STATIC_PATHS = ["", "/discover", "/explore", "/leaderboard", "/support", "/privacy", "/terms", "/refunds", "/legal"];

async function publicEvents() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("events")
      .select("slug, updated_at, starts_at, unlisted")
      .eq("status", "published")
      .or("unlisted.is.null,unlisted.eq.false")
      .order("starts_at", { ascending: false })
      .limit(5000);
    if (error) throw error;
    return (data ?? []).filter((row) => row.slug);
  } catch (error) {
    console.error("sitemap: could not load events", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const events = await publicEvents();
  return [
    ...STATIC_PATHS.map((path) => ({ url: `${SITE_URL}${path}`, lastModified: now, changeFrequency: "daily" as const, priority: path === "" ? 1 : 0.6 })),
    ...events.map((row) => ({
      url: `${SITE_URL}/events/${encodeURIComponent(row.slug)}`,
      lastModified: row.updated_at ? new Date(row.updated_at) : now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
