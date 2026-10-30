import type { SupabaseClient } from "@supabase/supabase-js";

/** Profile ids hidden for this viewer: people they blocked and people who blocked them. */
export async function getHiddenProfileIds(admin: SupabaseClient, userId: string | null | undefined) {
  if (!userId) return new Set<string>();
  const { data, error } = await admin.from("user_blocks").select("blocker_id,blocked_id").or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  // Table may not exist before the migration is applied: fail open, never break the feed.
  if (error || !data) return new Set<string>();
  return new Set(data.map((row) => (row.blocker_id === userId ? row.blocked_id : row.blocker_id) as string));
}
