"use client";

import { useState, type FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function PaymentMethodForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true); setNotice("");
    const result = await stripe.confirmSetup({ elements, redirect: "if_required" });
    if (result.error) { setNotice(result.error.message || "Payment method could not be saved."); setBusy(false); return; }
    onSaved();
  }

  return <form className="profile-payment-add" onSubmit={submit}><PaymentElement options={{ layout: "tabs" }} />{notice && <p role="status">{notice}</p>}<div><button type="button" onClick={onCancel}>Cancel</button><button type="submit" disabled={!stripe || busy}>{busy ? "Saving…" : "Save payment method"}</button></div></form>;
}

export function StripePaymentMethodForm({ clientSecret, onSaved, onCancel }: { clientSecret: string; onSaved: () => void; onCancel: () => void }) {
  if (!stripePromise) return <p role="status" className="profile-settings-empty">Payment methods are not available right now.</p>;
  return <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night", variables: { colorPrimary: "#ffffff", colorBackground: "#111111", colorText: "#ffffff", borderRadius: "10px" } } }}><PaymentMethodForm onCancel={onCancel} onSaved={onSaved} /></Elements>;
}
