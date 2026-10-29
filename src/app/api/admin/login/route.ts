import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string } | null;
  const email = String(body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid admin email" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return NextResponse.json({ error: "Admin sign in is temporarily unavailable" }, { status: 503 });
  const authUser = data.users.find((user) => user.email?.toLowerCase() === email);
  const { data: role } = authUser ? await admin.from("admin_users").select("user_id").eq("user_id", authUser.id).eq("active", true).maybeSingle() : { data: null };
  if (!authUser || !role) return NextResponse.json({ sent: true });
  const supabase = await createClient();
  const delivery = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (delivery.error) return NextResponse.json({ error: delivery.error.message }, { status: 400 });
  return NextResponse.json({ sent: true });
}
