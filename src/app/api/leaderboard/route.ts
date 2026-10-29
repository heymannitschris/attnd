import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { data, error } = await createAdminClient().from("user_points_accounts")
    .select("user_id,balance,lifetime_earned,level,profiles(first_name,username,avatar_url,city)")
    .order("level", { ascending: false })
    .order("lifetime_earned", { ascending: false })
    .limit(250);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const entries = (data || []).map((row, index) => {
    const profile = row.profiles as unknown as { first_name?: string | null; username?: string | null; avatar_url?: string | null; city?: string | null } | null;
    return {
      rank: index + 1,
      userId: row.user_id,
      name: profile?.first_name || profile?.username || "Attnd member",
      username: profile?.username || "",
      avatarUrl: profile?.avatar_url || "",
      city: profile?.city || "",
      points: row.balance,
      lifetimePoints: row.lifetime_earned,
      level: row.level,
    };
  });
  return NextResponse.json({ entries });
}
