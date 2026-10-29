import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export function createStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");
  return new Stripe(key);
}

export function getAppUrl(request?: Request) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return request ? new URL(request.url).origin : "http://localhost:3000";
}

export async function getStripeCustomerId(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("user_stripe_customers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  return data?.stripe_customer_id || null;
}

export async function getOrCreateStripeCustomer(user: { id: string; email?: string | null }) {
  const admin = createAdminClient();
  const existing = await getStripeCustomerId(user.id);
  if (existing) return existing;
  const stripe = createStripe();
  const customer = await stripe.customers.create({ email: user.email || undefined, metadata: { attnd_user_id: user.id } });
  const { error } = await admin.from("user_stripe_customers").insert({ user_id: user.id, stripe_customer_id: customer.id });
  if (error) {
    const { data: raced } = await admin.from("user_stripe_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    if (raced?.stripe_customer_id) { await stripe.customers.del(customer.id).catch(() => undefined); return raced.stripe_customer_id; }
    throw error;
  }
  return customer.id;
}
