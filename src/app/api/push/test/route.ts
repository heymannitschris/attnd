import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendApns } from "@/lib/apns";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data: devices, error } = await supabase.from("push_devices").select("token,environment").eq("user_id", user.id).eq("platform", "ios").eq("enabled", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!devices?.length) return NextResponse.json({ error: "No registered iPhone found. Enable Push Notifications first." }, { status: 404 });

  const results = await Promise.all(devices.map((device) => sendApns(device.token, device.environment, {
    title: "Attnd test notification",
    body: "Push notifications are working on this iPhone.",
    href: "/notifications",
  })));
  const sent = results.filter((result) => result.sent).length;
  if (!sent) return NextResponse.json({ error: results[0]?.reason || "The test notification could not be delivered" }, { status: 502 });
  return NextResponse.json({ sent });
}
