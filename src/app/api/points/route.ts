import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const admin = createAdminClient();
  const { data: account, error } = await admin.from("user_points_accounts").select("balance,lifetime_earned,level").eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const current = account || { balance: 0, lifetime_earned: 0, level: 0 };
  const { count } = await admin.from("user_points_accounts").select("user_id", { count: "exact", head: true }).or(`level.gt.${current.level},and(level.eq.${current.level},lifetime_earned.gt.${current.lifetime_earned})`);
  return NextResponse.json({ account: { ...current, nextLevelCost: (current.level + 1) * 100, rank: (count || 0) + 1 } });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await supabase.rpc("purchase_next_level");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const account = data?.[0];
  return NextResponse.json({ account: account ? { balance: account.balance, lifetime_earned: account.lifetime_earned, level: account.level, nextLevelCost: account.next_level_cost } : null });
}
