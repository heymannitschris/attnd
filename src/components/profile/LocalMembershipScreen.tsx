"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";

type Membership = { locality: string; status: "pending" | "verified" | "rejected" | "expired"; verified_at: string | null; expires_at: string | null; proof_original_name: string | null; review_note: string; submitted_at: string };
type MembershipResponse = { membership?: Membership | null; error?: string };

async function fetchMembership() {
  const response = await fetch("/api/local-membership", { cache: "no-store" });
  const data = await response.json() as MembershipResponse;
  return { response, data };
}

export function LocalMembershipScreen() {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const { response, data } = await fetchMembership();
    if (response.ok) setMembership(data.membership || null);
    else setNotice(data.error || "Could not load Local Membership");
    setLoading(false);
  }, []);
  useEffect(() => {
    let active = true;
    void fetchMembership().then(({ response, data }) => {
      if (!active) return;
      if (response.ok) setMembership(data.membership || null);
      else setNotice(data.error || "Could not load Local Membership");
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSending(true); setNotice("");
    const response = await fetch("/api/local-membership", { method: "POST", body: new FormData(event.currentTarget) });
    const data = await response.json() as { error?: string };
    setSending(false);
    if (!response.ok) return setNotice(data.error || "Could not submit your application");
    setNotice("Application sent. A host can now review your proof.");
    await load();
  }

  const canApply = !membership || membership.status === "rejected" || membership.status === "expired";
  return <main className="local-membership-screen">
    <header><Link href="/profile" aria-label="Back to profile"><DiscoverIcon name="chevron" /></Link><h1>Local Membership</h1></header>
    <div className="local-membership-content">
    <section className="local-membership-hero"><span className="local-membership-mark"><DiscoverIcon name="pin" /></span><div><p>LOCAL MEMBERSHIP</p><h2>Local benefits,<br />verified once.</h2><p>Verify where you live once. Free or discounted local entry is then shown automatically on eligible tickets.</p></div></section>
    {loading ? <section className="local-membership-card"><p>Loading membership…</p></section> : membership && !canApply ? <section className="local-membership-card">
      <div className={`local-membership-status is-${membership.status}`}><span>{membership.status === "verified" ? "✓" : "◴"}</span><div><small>STATUS</small><h2>{membership.status === "verified" ? "Verified Local" : "Application under review"}</h2></div></div>
      <dl><div><dt>Local area</dt><dd>{membership.locality}</dd></div><div><dt>Proof</dt><dd>{membership.proof_original_name || "Residence document"}</dd></div><div><dt>{membership.status === "verified" ? "Verified" : "Submitted"}</dt><dd>{new Date(membership.verified_at || membership.submitted_at).toLocaleDateString()}</dd></div></dl>
      <p>{membership.status === "verified" ? "Your Local Badge is active. Eligible ticket prices update automatically before checkout." : "Your document stays private. An event host for your local area can approve the application."}</p>
    </section> : <section className="local-membership-card">
      {membership?.status === "rejected" && <div className="local-membership-rejected"><strong>Application needs an update</strong><p>{membership.review_note || "Please upload a current proof of residence and apply again."}</p></div>}
      <h2>{membership ? "Apply again" : "Apply as a Local"}</h2><p>Upload a document showing your name and local address. Accepted files: JPG, PNG, WebP or PDF, up to 8 MB.</p>
      <form onSubmit={apply}><label>City or local area<input name="locality" defaultValue={membership?.locality || ""} placeholder="Koh Phangan" minLength={2} maxLength={100} required /></label><label>Proof of residence<input name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required /></label><button type="submit" disabled={sending}>{sending ? "Sending…" : "Submit Application"}</button></form>
    </section>}
    <section className="local-membership-privacy"><DiscoverIcon name="lock" /><div><strong>Your document is private</strong><p>It is only available to authorised hosts reviewing Local Membership applications.</p></div></section>
    {notice && <p role="status" className="local-membership-notice">{notice}</p>}
    </div>
  </main>;
}
