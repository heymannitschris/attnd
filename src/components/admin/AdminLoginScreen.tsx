"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AdminLoginScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(search.get("error") === "access" ? "This account does not have admin access." : "");
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return; checked.current = true;
    void (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: role } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).eq("active", true).maybeSingle();
      if (role) router.replace("/admin");
    })();
  }, [router]);

  async function requestCode(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setNotice(result.error || "The code could not be sent.");
    setStep("code"); setNotice("If this address belongs to an active admin, a sign-in code is on its way.");
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.replace(/\D/g, ""), type: "email" });
    if (error || !data.user) { setBusy(false); setNotice(error?.message || "The code is invalid or expired."); return; }
    const { data: role } = await supabase.from("admin_users").select("user_id").eq("user_id", data.user.id).eq("active", true).maybeSingle();
    if (!role) { await supabase.auth.signOut(); setBusy(false); setNotice("This account does not have admin access."); return; }
    router.replace("/admin"); router.refresh();
  }

  return <main className="admin-login-page">
    <section className="admin-login-brand"><Link href="/">attnd</Link><span>ADMINISTRATION</span><div><p>OPERATIONS CONSOLE</p><h1>Run every event<br />with confidence.</h1><p>Moderation, payments, memberships and platform health in one secure workspace.</p></div><small>Restricted access · Attnd administrators only</small></section>
    <section className="admin-login-panel"><div className="admin-login-box"><header><span>SECURE ACCESS</span><h2>Admin sign in</h2><p>Use the email address assigned to your Attnd administrator account.</p></header>
      {step === "email" ? <form onSubmit={requestCode}><label>Admin email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@attnd.space" autoComplete="email" required autoFocus /></label><button type="submit" disabled={busy}>{busy ? "Checking…" : "Continue securely"}</button></form> : <form onSubmit={verifyCode}><button type="button" className="admin-login-back" onClick={() => { setStep("email"); setCode(""); setNotice(""); }}>← Change email</button><label>Six digit code<input className="admin-login-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" minLength={6} maxLength={6} required autoFocus /></label><button type="submit" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Open Admin Dashboard"}</button></form>}
      {notice && <p role="status" className="admin-login-notice">{notice}</p>}<footer><span>Encrypted sign in</span><span>Role verified</span><span>Audited access</span></footer></div></section>
  </main>;
}
