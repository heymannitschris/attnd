import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily reset of the App Review demo purchase (cron) or on demand:
// curl -H "Authorization: Bearer $CRON_SECRET" https://www.attnd.space/api/cron/reset-review-demo
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("reset_review_demo_purchases");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, removed: data });
}
