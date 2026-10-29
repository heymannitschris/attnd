import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ProfileRow = {
  id: string;
  first_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: profile }, { data: followRows, error: followError }] = await Promise.all([
    admin.from("profiles").select("id,first_name,username,avatar_url").eq("id", user.id).maybeSingle(),
    admin.from("profile_follows").select("following_id").eq("follower_id", user.id).order("created_at", { ascending: false }),
  ]);
  if (followError) return NextResponse.json({ error: followError.message }, { status: 400 });

  const followingIds = (followRows || []).map((row) => row.following_id);
  const { data: following, error: profileError } = followingIds.length
    ? await admin.from("profiles").select("id,first_name,username,avatar_url").in("id", followingIds)
    : { data: [] as ProfileRow[], error: null };
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

  const metadata = user.user_metadata as Record<string, unknown>;
  const profileName = String(profile?.first_name || metadata.full_name || metadata.name || "");
  const split = splitName(profileName);
  const firstName = String(metadata.first_name || metadata.given_name || split.firstName || "");
  const lastName = String(metadata.last_name || metadata.family_name || split.lastName || "");
  const order = new Map(followingIds.map((id, index) => [id, index]));

  return NextResponse.json({
    attendee: { userId: user.id, firstName, lastName, email: user.email || "" },
    following: ((following || []) as ProfileRow[])
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((person) => ({
        id: person.id,
        name: person.first_name || person.username || "Attnd member",
        username: person.username || "",
        avatarUrl: person.avatar_url || null,
      })),
  });
}
