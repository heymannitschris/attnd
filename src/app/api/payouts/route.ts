import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripe } from "@/lib/stripe";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const requestedSource = new URL(request.url).searchParams.get("source");
  const source = requestedSource === "host" || requestedSource === "cohost" || requestedSource === "team" ? requestedSource : "affiliate";
  const { data, error } = await supabase.from("payout_requests").select("id,amount_minor,fee_minor,currency,method,status,created_at,paid_at,failure_reason").eq("user_id", user.id).eq("source", source).order("created_at", { ascending: false });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ payouts: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json() as { source?: "affiliate" | "host" | "cohost" | "team"; amountMinor?: number; currency?: string };
  const source = body.source === "host" || body.source === "cohost" || body.source === "team" ? body.source : "affiliate";
  const amountMinor = Math.floor(Number(body.amountMinor));
  const currency = String(body.currency || "eur").toLowerCase();
  if (!Number.isInteger(amountMinor) || amountMinor < 5000 || !/^[a-z]{3}$/.test(currency)) return NextResponse.json({ error: "Minimum payout is 50.00" }, { status: 400 });
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("stripe_connect_account_id").eq("id", user.id).single();
  if (!profile?.stripe_connect_account_id) return NextResponse.json({ error: "Connect a payout account first", setupRequired: true }, { status: 409 });
  const stripe = createStripe();
  const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);
  if (account.capabilities?.transfers !== "active" || !account.payouts_enabled) {
    return NextResponse.json({ error: "Complete your Stripe payout setup first", setupRequired: true }, { status: 409 });
  }
  const feeMinor = Math.round(amountMinor * 0.01);
  const { data: payoutId, error } = await admin.rpc("reserve_payout_request", { p_user_id: user.id, p_source: source, p_currency: currency, p_amount_minor: amountMinor, p_fee_minor: feeMinor });
  if (error || !payoutId) return NextResponse.json({ error: error?.message || "Payout could not be reserved" }, { status: error?.message?.includes("available balance") ? 409 : 400 });
  let transfer;
  try {
    transfer = await stripe.transfers.create({ amount: amountMinor - feeMinor, currency, destination: profile.stripe_connect_account_id, metadata: { payout_request_id: payoutId, attnd_user_id: user.id, source } }, { idempotencyKey: `attnd-payout-${payoutId}` });
  } catch (error) {
    await admin.from("payout_requests").update({ status: "failed", failure_reason: error instanceof Error ? error.message : "Stripe transfer failed" }).eq("id", payoutId);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payout failed" }, { status: 502 });
  }
  const { error: updateError } = await admin.from("payout_requests").update({ provider_transfer_id: transfer.id, status: "paid", paid_at: new Date().toISOString() }).eq("id", payoutId);
  if (updateError) return NextResponse.json({ error: "Transfer sent; payout record needs reconciliation", payoutId }, { status: 500 });
  return NextResponse.json({ payoutId, status: "paid" });
}
