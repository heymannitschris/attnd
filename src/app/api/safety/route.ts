import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyModeration } from "@/lib/report-mail";
import { createClient } from "@/lib/supabase/server";

const targetTypes = ["profile", "event", "review", "moment"] as const;
type TargetType = (typeof targetTypes)[number];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in to report or block." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { action?: "report" | "block" | "unblock"; targetType?: TargetType; targetId?: string; reason?: string; details?: string };
  if (!body.targetId || !uuid.test(body.targetId)) return NextResponse.json({ error: "This item can't be reported yet." }, { status: 400 });
  const admin = createAdminClient();

  if (body.action === "block" || body.action === "unblock") {
    if (body.targetId === user.id) return NextResponse.json({ error: "You can't block yourself." }, { status: 400 });
    const result = body.action === "block"
      ? await admin.from("user_blocks").upsert({ blocker_id: user.id, blocked_id: body.targetId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true })
      : await admin.from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", body.targetId);
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "report") {
    if (!body.targetType || !targetTypes.includes(body.targetType)) return NextResponse.json({ error: "Unknown report type." }, { status: 400 });
    const { error } = await admin.from("content_reports").upsert({
      reporter_id: user.id, target_type: body.targetType, target_id: body.targetId,
      reason: (body.reason || "inappropriate").slice(0, 60), details: body.details?.slice(0, 1000) || null, status: "open",
    }, { onConflict: "reporter_id,target_type,target_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const path = body.targetType === "profile" ? `/people/${body.targetId}` : body.targetType === "event" ? `/events/${body.targetId}` : "/admin";
    await notifyModeration({ request, targetType: body.targetType, targetId: body.targetId, reason: body.reason || "inappropriate", reporterId: user.id, path });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
