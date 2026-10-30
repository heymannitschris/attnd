import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyModeration } from "@/lib/report-mail";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ id: string; momentId: string }> }) {
  const { id, momentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: "share" | "report"; reason?: string } | null;
  if (!body?.action) return NextResponse.json({ error: "Missing action" }, { status: 400 });
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id").or(`id.eq.${id},slug.eq.${id}`).eq("status", "published").maybeSingle();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const { data: moment } = await admin.from("event_live_moments").select("id").eq("id", momentId).eq("event_id", event.id).maybeSingle();
  if (!moment) return NextResponse.json({ error: "Moment not found" }, { status: 404 });
  if (body.action === "share") {
    const { error } = await admin.from("event_live_moment_shares").insert({ moment_id: moment.id, user_id: user.id });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ recorded: true });
  }
  const reason = String(body.reason || "inappropriate").trim().slice(0, 200);
  const { error } = await admin.from("event_live_moment_reports").upsert({ moment_id: moment.id, reporter_id: user.id, reason, status: "open" }, { onConflict: "moment_id,reporter_id" });
  if (!error) await notifyModeration({ request, targetType: "live moment", targetId: moment.id, reason, reporterId: user.id, path: `/events/${event.id}` });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ reported: true });
}
