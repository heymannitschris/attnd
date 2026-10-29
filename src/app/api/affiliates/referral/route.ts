import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const affiliateId = (await cookies()).get("attnd_affiliate")?.value;
  if (!affiliateId || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(affiliateId) || affiliateId === user.id) {
    return NextResponse.json({ recorded: false });
  }
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("onboarding_complete").eq("id", user.id).maybeSingle();
  if (!profile?.onboarding_complete) return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
  const { error } = await admin.from("user_referrals").upsert({ referred_user_id: user.id, affiliate_user_id: affiliateId }, { onConflict: "referred_user_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Referral could not be recorded" }, { status: 400 });
  return NextResponse.json({ recorded: true });
}
