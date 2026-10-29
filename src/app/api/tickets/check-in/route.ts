import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { token } = await request.json() as { token?: string };
  if (!token) return NextResponse.json({ error: "Missing QR token" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const guestlist = token.startsWith("attnd:guestlist:");
  const cleanToken = token.replace(/^attnd:(ticket|guestlist):/, "").trim();
  const { data, error } = guestlist
    ? await supabase.rpc("check_in_guestlist", { p_access_token: cleanToken })
    : await supabase.rpc("check_in_ticket", { p_qr_token: cleanToken });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ticket: data?.[0], accessType: guestlist ? "guestlist" : "ticket" });
}
