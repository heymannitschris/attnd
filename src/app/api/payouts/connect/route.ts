import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createStripe, getAppUrl } from "@/lib/stripe";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: profile, error } = await supabase.from("profiles").select("stripe_connect_account_id").eq("id", user.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!profile?.stripe_connect_account_id) return NextResponse.json({ ready: false, setupRequired: true, accountCreated: false });
  try {
    const account = await createStripe().accounts.retrieve(profile.stripe_connect_account_id);
    const ready = account.capabilities?.transfers === "active" && account.payouts_enabled;
    return NextResponse.json({ ready, setupRequired: !ready, accountCreated: true, detailsSubmitted: account.details_submitted });
  } catch {
    return NextResponse.json({ ready: false, setupRequired: true, accountCreated: true });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { source } = await request.json().catch(() => ({ source: "affiliate" })) as { source?: "affiliate" | "host" | "cohost" | "team" };
  const { data: profile } = await supabase.from("profiles").select("stripe_connect_account_id").eq("id", user.id).single();
  const stripe = createStripe();
  let accountId = profile?.stripe_connect_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({ type: "express", email: user.email, capabilities: { transfers: { requested: true } }, metadata: { attnd_user_id: user.id } });
    accountId = account.id;
    const { error } = await supabase.from("profiles").update({ stripe_connect_account_id: accountId }).eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const appUrl = getAppUrl(request);
  const returnPath = source === "host" || source === "cohost" || source === "team" ? `/dashboard/withdraw${source === "host" ? "" : `?source=${source}`}` : "/affiliate/withdraw";
  const link = await stripe.accountLinks.create({ account: accountId, type: "account_onboarding", refresh_url: `${appUrl}${returnPath}`, return_url: `${appUrl}${returnPath}${returnPath.includes("?") ? "&" : "?"}connected=1` });
  return NextResponse.json({ url: link.url });
}
