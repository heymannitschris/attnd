import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getAdminActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: role } = await admin.from("admin_users").select("role,active").eq("user_id", user.id).eq("active", true).maybeSingle();
  return role ? { user, role: role.role as string, admin } : null;
}

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const admin = createAdminClient();
  const { data: role } = await admin.from("admin_users").select("role,active").eq("user_id", user.id).eq("active", true).maybeSingle();
  if (!role) redirect("/admin/login?error=access");
  return { user, role: role.role as string, admin };
}
