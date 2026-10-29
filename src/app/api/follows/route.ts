import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/notify";

const uuid = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ following: [], followers: [] });
  const [followingResult, followersResult] = await Promise.all([
    supabase.from("profile_follows").select("following_id").eq("follower_id", user.id),
    supabase.from("profile_follows").select("follower_id").eq("following_id", user.id),
  ]);
  const error = followingResult.error || followersResult.error;
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({
    following: (followingResult.data || []).map((row) => row.following_id),
    followers: (followersResult.data || []).map((row) => row.follower_id),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { profileId } = await request.json().catch(() => ({})) as { profileId?: string };
  if (!profileId || !uuid.test(profileId) || profileId === user.id) return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  const { error } = await supabase.from("profile_follows").upsert({ follower_id: user.id, following_id: profileId }, { onConflict: "follower_id,following_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { data: profile } = await supabase.from("profiles").select("first_name,username").eq("id", user.id).maybeSingle();
  await notifyUsers([profileId], { category: "Community", title: "New follower", body: `${profile?.first_name || profile?.username || "Someone"} started following you.`, href: `/people/${user.id}`, preference: "followers" });
  return NextResponse.json({ following: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const profileId = new URL(request.url).searchParams.get("profileId");
  if (!profileId || !uuid.test(profileId)) return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  const { error } = await supabase.from("profile_follows").delete().eq("follower_id", user.id).eq("following_id", profileId);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ following: false });
}
