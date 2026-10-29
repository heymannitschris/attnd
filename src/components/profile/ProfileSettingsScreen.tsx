"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";
import { useAppLanguage } from "@/components/i18n/AppLanguageProvider";
import type { AppLanguage } from "@/lib/app-translations";
import { createClient } from "@/lib/supabase/client";

type PaymentMethod = { id: string; brand: string; last4: string; expMonth?: number; expYear?: number; default: boolean };
type SettingsSection = "profile" | "interests" | "about" | "security" | "payments" | "visibility" | "language";
type ProfileVisibility = "everyone" | "followers" | "private";
const interestOptions = ["Music", "Nightlife", "Festival", "Party", "Wellness", "Yoga", "Fitness", "Sports", "Workshop", "Education", "Business", "Networking", "Tech", "Art", "Culture", "Food", "Nature", "Travel", "Community", "Charity", "Family", "Retreat", "Meetup", "Spiritual"];
const StripePaymentMethodForm = dynamic(() => import("./StripePaymentMethodForm").then((module) => module.StripePaymentMethodForm), { ssr: false, loading: () => <p className="profile-settings-empty">Loading secure payment form…</p> });

function SettingsHeading({ icon, title, text, open, onToggle }: { icon: "users" | "layers" | "info" | "lock" | "ticket" | "eye" | "navigation"; title: string; text: string; open: boolean; onToggle: () => void }) {
  return <button type="button" className="profile-settings-heading profile-settings-toggle" aria-expanded={open} onClick={onToggle}><span><DiscoverIcon name={icon} /></span><div><h2>{title}</h2><p>{text}</p></div><DiscoverIcon name="chevron" /></button>;
}

export function ProfileSettingsScreen() {
  const router = useRouter();
  const { language, setLanguage } = useAppLanguage();
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [about, setAbout] = useState("");
  const [notificationPreferences, setNotificationPreferences] = useState<Record<string, unknown>>({});
  const [publicAttendance, setPublicAttendance] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>("everyone");
  const [allowEventInvites, setAllowEventInvites] = useState(true);
  const [showUpcomingEvents, setShowUpcomingEvents] = useState(false);
  const [openSection, setOpenSection] = useState<SettingsSection | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [clientSecret, setClientSecret] = useState("");
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [methodsLoaded, setMethodsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const loadMethods = useCallback(async () => {
    setLoadingMethods(true);
    const response = await fetch("/api/payment-methods", { cache: "no-store" });
    const result = await response.json() as { methods?: PaymentMethod[]; error?: string };
    if (response.ok) setMethods(result.methods || []); else setNotice(result.error || "Payment methods could not be loaded.");
    setMethodsLoaded(true);
    setLoadingMethods(false);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      setEmail(user.email || ""); setOriginalEmail(user.email || "");
      const { data: profile } = await supabase.from("profiles").select("first_name,username,city,interests,bio,notification_preferences").eq("id", user.id).maybeSingle();
      if (!active) return;
      setFirstName(profile?.first_name || ""); setUsername(profile?.username || ""); setCity(profile?.city || ""); setInterests(profile?.interests || []); setAbout(profile?.bio || "");
      const preferences = (profile?.notification_preferences || {}) as Record<string, unknown>;
      setNotificationPreferences(preferences);
      setPublicAttendance(Boolean(preferences.public_attendance));
      setProfileVisibility(["everyone", "followers", "private"].includes(String(preferences.profile_visibility)) ? preferences.profile_visibility as ProfileVisibility : "everyone");
      setAllowEventInvites(preferences.allow_event_invites !== false);
      setShowUpcomingEvents(Boolean(preferences.show_upcoming_events));
    })();
    return () => { active = false; };
  }, [loadMethods]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setNotice("Please sign in again."); setBusy(false); return; }
    const cleanUsername = username.trim().replace(/^@/, "");
    const { error } = await supabase.from("profiles").update({ first_name: firstName.trim(), username: cleanUsername, city: city.trim(), updated_at: new Date().toISOString() }).eq("id", user.id);
    if (error) { setNotice(error.message); setBusy(false); return; }
    if (email.trim().toLowerCase() !== originalEmail.toLowerCase()) {
      const { error: emailError } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() });
      if (emailError) { setNotice(emailError.message); setBusy(false); return; }
      setOriginalEmail(email.trim().toLowerCase());
      setNotice("Profile saved. Confirm your new email address from the message we sent.");
    } else setNotice("Profile details saved.");
    setUsername(cleanUsername); setBusy(false);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice("");
    if (password.length < 8) return setNotice("Use at least 8 characters for your password.");
    if (password !== confirmPassword) return setNotice("The passwords do not match.");
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setNotice(error.message);
    setPassword(""); setConfirmPassword(""); setNotice("Password updated securely.");
  }

  async function saveProfileContent(kind: "interests" | "about") {
    setBusy(true); setNotice("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return setNotice("Please sign in again."); }
    const values = kind === "interests" ? { interests, updated_at: new Date().toISOString() } : { bio: about.trim(), updated_at: new Date().toISOString() };
    const { error } = await supabase.from("profiles").update(values).eq("id", user.id);
    setBusy(false);
    setNotice(error ? error.message : kind === "interests" ? "Interests saved." : "About Me saved.");
    if (!error) setOpenSection(null);
  }

  async function beginAddMethod() {
    setNotice("");
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) return setNotice("Payment methods are not available right now.");
    const response = await fetch("/api/payment-methods", { method: "POST" });
    const result = await response.json() as { clientSecret?: string; error?: string };
    if (!response.ok || !result.clientSecret) return setNotice(result.error || "Payment setup could not be started.");
    setClientSecret(result.clientSecret);
  }

  async function updateMethod(id: string, action: "default" | "remove") {
    setNotice("");
    const response = await fetch(action === "remove" ? `/api/payment-methods?id=${encodeURIComponent(id)}` : "/api/payment-methods", action === "remove" ? { method: "DELETE" } : { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ paymentMethodId: id }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setNotice(result.error || "Payment method could not be updated.");
    setNotice(action === "remove" ? "Payment method removed." : "Default payment method updated.");
    await loadMethods();
  }

  async function saveVisibility(patch: { profile_visibility?: ProfileVisibility; allow_event_invites?: boolean; show_upcoming_events?: boolean; public_attendance?: boolean }) {
    const nextPreferences = { ...notificationPreferences, ...patch };
    setBusy(true); setNotice("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return setNotice("Please sign in again."); }
    const { error } = await supabase.from("profiles").update({ notification_preferences: nextPreferences, updated_at: new Date().toISOString() }).eq("id", user.id);
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotificationPreferences(nextPreferences);
    if (patch.profile_visibility) setProfileVisibility(patch.profile_visibility);
    if (typeof patch.allow_event_invites === "boolean") setAllowEventInvites(patch.allow_event_invites);
    if (typeof patch.show_upcoming_events === "boolean") setShowUpcomingEvents(patch.show_upcoming_events);
    if (typeof patch.public_attendance === "boolean") setPublicAttendance(patch.public_attendance);
    setNotice("Visibility settings saved.");
  }

  async function changeLanguage(next: AppLanguage) {
    setLanguage(next); setNotice("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from("profiles").update({ language: next === "th" ? "ภาษาไทย" : "English", updated_at: new Date().toISOString() }).eq("id", user.id);
      if (error) return setNotice(error.message);
    }
    setNotice(next === "th" ? "App language changed to Thai." : "App language changed to English.");
  }

  async function signOut() {
    await createClient().auth.signOut();
    window.localStorage.removeItem("attnd:onboarding-complete");
    router.replace("/onboarding");
  }

  return <main className="profile-settings-screen">
    <header><Link href="/profile" aria-label="Back to profile"><DiscoverIcon name="chevron" /></Link><div><h1>Profile Settings</h1></div><span /></header>
    <form className="profile-settings-card" data-open={openSection === "profile"} onSubmit={saveProfile}><SettingsHeading icon="users" title="Personal details" text="Name, username, city and email." open={openSection === "profile"} onToggle={() => setOpenSection(openSection === "profile" ? null : "profile")} />{openSection === "profile" && <div className="profile-settings-body"><label>Display name<input value={firstName} onChange={(event) => setFirstName(event.target.value)} minLength={2} maxLength={40} required /></label><label>Username<div className="profile-username-field"><span>@</span><input value={username} onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9._]/g, ""))} minLength={3} maxLength={24} required /></div></label><label>Home city<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Koh Phangan" /></label><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><button className="profile-settings-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button></div>}</form>
    <section className="profile-settings-card" data-open={openSection === "interests"}><SettingsHeading icon="layers" title="Interests" text={interests.length ? `${interests.length} selected` : "Choose what you want to discover."} open={openSection === "interests"} onToggle={() => setOpenSection(openSection === "interests" ? null : "interests")} />{openSection === "interests" && <div className="profile-settings-body"><div className="profile-settings-interests">{interestOptions.map((interest) => <button type="button" key={interest} aria-pressed={interests.includes(interest)} onClick={() => setInterests(interests.includes(interest) ? interests.filter((item) => item !== interest) : [...interests, interest])}>{interests.includes(interest) && <DiscoverIcon name="check" />}{interest}</button>)}</div><button type="button" className="profile-settings-primary" disabled={busy} onClick={() => void saveProfileContent("interests")}>{busy ? "Saving…" : "Save interests"}</button></div>}</section>
    <section className="profile-settings-card" data-open={openSection === "about"}><SettingsHeading icon="info" title="About Me" text={about ? "Your profile introduction." : "Tell people a little about yourself."} open={openSection === "about"} onToggle={() => setOpenSection(openSection === "about" ? null : "about")} />{openSection === "about" && <div className="profile-settings-body"><label>About Me<textarea value={about} onChange={(event) => setAbout(event.target.value)} maxLength={600} placeholder="Tell people about yourself…" /></label><small className="profile-settings-count">{about.length}/600</small><button type="button" className="profile-settings-primary" disabled={busy} onClick={() => void saveProfileContent("about")}>{busy ? "Saving…" : "Save About Me"}</button></div>}</section>
    <form className="profile-settings-card" data-open={openSection === "security"} onSubmit={changePassword}><SettingsHeading icon="lock" title="Login & security" text="Create or change your password." open={openSection === "security"} onToggle={() => setOpenSection(openSection === "security" ? null : "security")} />{openSection === "security" && <div className="profile-settings-body"><label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" placeholder="At least 8 characters" required /></label><label>Confirm new password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} autoComplete="new-password" required /></label><button className="profile-settings-primary" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></div>}</form>
    <section className="profile-settings-card" data-open={openSection === "payments"}><SettingsHeading icon="ticket" title="Payment methods" text={methods.length ? `${methods.length} saved` : "Cards for faster checkout."} open={openSection === "payments"} onToggle={() => { const opening = openSection !== "payments"; setOpenSection(opening ? "payments" : null); if (opening && !methodsLoaded && !loadingMethods) void loadMethods(); }} />{openSection === "payments" && <div className="profile-settings-body">{loadingMethods ? <p className="profile-settings-empty">Loading payment methods…</p> : methods.length ? <div className="profile-payment-list">{methods.map((method) => <article key={method.id}><span className="profile-card-brand">{method.brand.toUpperCase()}</span><p><strong>•••• {method.last4}</strong><small>Expires {String(method.expMonth).padStart(2, "0")}/{String(method.expYear).slice(-2)}</small></p>{method.default ? <b>Default</b> : <button type="button" onClick={() => void updateMethod(method.id, "default")}>Make default</button>}<button type="button" className="profile-payment-remove" aria-label={`Remove card ending ${method.last4}`} onClick={() => void updateMethod(method.id, "remove")}><DiscoverIcon name="x" /></button></article>)}</div> : <p className="profile-settings-empty">No saved payment methods yet.</p>}{clientSecret ? <StripePaymentMethodForm clientSecret={clientSecret} onCancel={() => setClientSecret("")} onSaved={() => { setClientSecret(""); setNotice("Payment method saved."); void loadMethods(); }} /> : <button type="button" className="profile-settings-add-payment" onClick={() => void beginAddMethod()}>＋ Add payment method</button>}<small className="profile-payment-security"><DiscoverIcon name="lock" />Payment details are encrypted and stored by Stripe.</small></div>}</section>
    <section className="profile-settings-card" data-open={openSection === "visibility"}><SettingsHeading icon="eye" title="Visibility" text={profileVisibility === "everyone" ? "Visible to everyone." : profileVisibility === "followers" ? "Visible to followers." : "Private profile."} open={openSection === "visibility"} onToggle={() => setOpenSection(openSection === "visibility" ? null : "visibility")} />{openSection === "visibility" && <div className="profile-settings-body"><label className="profile-settings-visibility-label">Who can view your profile?</label><div className="profile-settings-visibility" role="radiogroup" aria-label="Profile visibility">{([['everyone','Everyone'],['followers','Followers'],['private','Private']] as const).map(([value,label]) => <button type="button" role="radio" aria-checked={profileVisibility === value} key={value} disabled={busy} onClick={() => void saveVisibility({ profile_visibility: value })}>{profileVisibility === value && <DiscoverIcon name="check" />}{label}</button>)}</div><div className="profile-settings-switch-row"><div><strong>Allow event invites</strong><small>Let other members send event invitations directly to you.</small></div><button type="button" role="switch" aria-checked={allowEventInvites} aria-label="Allow direct event invitations" disabled={busy} onClick={() => void saveVisibility({ allow_event_invites: !allowEventInvites })}><span /></button></div><div className="profile-settings-switch-row"><div><strong>Show upcoming events</strong><small>Display events you are joining on your public profile.</small></div><button type="button" role="switch" aria-checked={showUpcomingEvents} aria-label="Show upcoming events on profile" disabled={busy} onClick={() => void saveVisibility({ show_upcoming_events: !showUpcomingEvents })}><span /></button></div><div className="profile-settings-switch-row"><div><strong>Show me in guest lists</strong><small>Let people see you in attendee lists and event previews.</small></div><button type="button" role="switch" aria-checked={publicAttendance} aria-label="Show event attendance publicly" disabled={busy} onClick={() => void saveVisibility({ public_attendance: !publicAttendance })}><span /></button></div></div>}</section>
    <section className="profile-settings-card" data-open={openSection === "language"}><SettingsHeading icon="navigation" title="App language" text={language === "th" ? "ภาษาไทย" : "English"} open={openSection === "language"} onToggle={() => setOpenSection(openSection === "language" ? null : "language")} />{openSection === "language" && <div className="profile-settings-body"><div className="profile-settings-languages" role="radiogroup" aria-label="App language"><button type="button" role="radio" aria-checked={language === "en"} onClick={() => void changeLanguage("en")}><span>🇬🇧</span><strong>English</strong>{language === "en" && <DiscoverIcon name="check" />}</button><button type="button" role="radio" aria-checked={language === "th"} onClick={() => void changeLanguage("th")}><span>🇹🇭</span><strong>ภาษาไทย</strong>{language === "th" && <DiscoverIcon name="check" />}</button></div></div>}</section>
    <Link href="/profile/local-membership" className="profile-settings-link"><span><DiscoverIcon name="pin" /></span><p><strong>Local Membership</strong><small>Apply, verify your address and manage local entry benefits.</small></p><DiscoverIcon name="chevron" /></Link>
    <Link href="/notifications/settings" className="profile-settings-link"><span><DiscoverIcon name="bell" /></span><p><strong>Notification Settings</strong><small>Choose the updates you receive.</small></p><DiscoverIcon name="chevron" /></Link>
    <button type="button" className="profile-settings-signout" onClick={() => void signOut()}>Sign out</button>
    {notice && <p role="status" className="profile-settings-notice">{notice}</p>}
  </main>;
}
