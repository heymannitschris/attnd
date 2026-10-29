import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createStripe, getOrCreateStripeCustomer, getStripeCustomerId } from "@/lib/stripe";

async function authenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  try {
    const user = await authenticatedUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const customerId = await getStripeCustomerId(user.id);
    if (!customerId) return NextResponse.json({ methods: [] });
    const stripe = createStripe();
    const [methods, customer] = await Promise.all([
      stripe.paymentMethods.list({ customer: customerId, type: "card" }),
      stripe.customers.retrieve(customerId),
    ]);
    const defaultId = !customer.deleted && typeof customer.invoice_settings.default_payment_method === "string" ? customer.invoice_settings.default_payment_method : null;
    return NextResponse.json({ methods: methods.data.map((method) => ({ id: method.id, brand: method.card?.brand || "card", last4: method.card?.last4 || "", expMonth: method.card?.exp_month, expYear: method.card?.exp_year, default: method.id === defaultId })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment methods could not be loaded" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await authenticatedUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const stripe = createStripe();
    const customerId = await getOrCreateStripeCustomer(user);
    const setupIntent = await stripe.setupIntents.create({ customer: customerId, usage: "off_session", automatic_payment_methods: { enabled: true }, metadata: { attnd_user_id: user.id } });
    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment setup could not be started" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await authenticatedUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { paymentMethodId } = await request.json() as { paymentMethodId?: string };
    if (!paymentMethodId) return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
    const stripe = createStripe();
    const customerId = await getOrCreateStripeCustomer(user);
    const method = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (method.customer !== customerId) return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment method could not be updated" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await authenticatedUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const paymentMethodId = new URL(request.url).searchParams.get("id");
    if (!paymentMethodId) return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
    const stripe = createStripe();
    const customerId = await getOrCreateStripeCustomer(user);
    const method = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (method.customer !== customerId) return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted && customer.invoice_settings.default_payment_method === paymentMethodId) await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: "" } });
    await stripe.paymentMethods.detach(paymentMethodId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment method could not be removed" }, { status: 500 });
  }
}
