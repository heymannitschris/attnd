import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return NextResponse.json({ reviews: [], summary: { count: 0, average: 0 } });
  const admin = createAdminClient();
  const { data, error } = await admin.from("host_reviews")
    .select("id,rating,body,created_at,user_id,profiles!host_reviews_user_id_fkey(first_name,username,avatar_url),events(title,slug)")
    .eq("host_id", id).eq("status", "published").order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const reviews = data || [];
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return NextResponse.json({ reviews, summary: { count: reviews.length, average: reviews.length ? Number((total / reviews.length).toFixed(1)) : 0 } });
}
