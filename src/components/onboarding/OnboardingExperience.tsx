"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { Circle, CircleMarker, Map as LeafletMap } from "leaflet";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig, requireSupabaseConfig } from "@/lib/supabase/config";
import { useAppLanguage } from "@/components/i18n/AppLanguageProvider";

type Screen = "splash" | "welcome" | "login" | "signup" | "email" | "phone" | "code" | "password" | "profile";

const interests = ["Music", "Nightlife", "Festival", "Party", "Wellness", "Yoga", "Fitness", "Sports", "Workshop", "Education", "Business", "Networking", "Tech", "Art", "Culture", "Food", "Nature", "Travel", "Community", "Charity", "Family", "Retreat", "Meetup", "Spiritual"];
const languages = ["🇬🇧  English", "🇹🇭  ภาษาไทย"];
const notificationOptions = [
  ["Event invites", "When someone invites you"],
  ["Ticket updates", "When your ticket status changes"],
  ["Followers", "When someone follows you"],
  ["Event recommendations", "Personalized event suggestions"],
  ["Product updates", "News and new features"],
];

function requestedReturnPath() {
  if (typeof window === "undefined") return "/discover";
  const requested = new URLSearchParams(window.location.search).get("next");
  return requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/discover";
}

function Icon({ name, size = 22 }: { name: "mail" | "phone" | "apple" | "google" | "user" | "camera" | "pin" | "bell" | "back"; size?: number }) {
  if (name === "google") return <span className="onboarding-google" aria-hidden="true">G</span>;
  if (name === "apple") return <svg className="onboarding-apple" width={size} height={size} viewBox="0 0 24 28" aria-hidden="true"><path fill="currentColor" d="M19.9 14.8c0-3.5 2.9-5.2 3-5.3a6.3 6.3 0 0 0-5-2.7c-2.1-.2-4.2 1.3-5.3 1.3-1.1 0-2.8-1.3-4.6-1.2A6.8 6.8 0 0 0 2.2 10c-2.5 4.3-.6 10.6 1.7 14.1 1.1 1.7 2.5 3.5 4.3 3.4 1.7-.1 2.4-1.1 4.5-1.1s2.7 1.1 4.5 1c1.9 0 3-1.7 4.2-3.4a15.4 15.4 0 0 0 1.9-4c-.1 0-3.4-1.3-3.4-5.2ZM16.5 4.6A6.1 6.1 0 0 0 17.9 0a6.3 6.3 0 0 0-4.2 2.2 5.8 5.8 0 0 0-1.5 4.4 5.2 5.2 0 0 0 4.3-2Z" /></svg>;
  const paths: Record<Exclude<typeof name, "google" | "apple">, ReactNode> = {
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 22c.6-5 3.3-7 8-7s7.4 2 8 7" /></>,
    camera: <><path d="M4 7h4l2-2h4l2 2h4v12H4z" /><circle cx="12" cy="13" r="3" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    back: <path d="m15 18-6-6 6-6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name as keyof typeof paths]}</svg>;
}

function AttndLogo({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  return <Image className={`${compact ? "onboarding-logo compact" : "onboarding-logo"}${dark ? " dark" : ""}`} src="/brand/attnd-logo-serif-white.png" alt="Attnd" width={1774} height={887} priority />;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="onboarding-back" onClick={onClick} aria-label="Go back"><Icon name="back" size={26} /></button>;
}

function PrimaryButton({ children, onClick, type = "button", disabled = false }: { children: ReactNode; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean }) {
  return <button type={type} className="onboarding-primary" onClick={onClick} disabled={disabled}>{children}</button>;
}

export function OnboardingExperience({ initialAuthScreen }: { initialAuthScreen?: "login" | "signup" }) {
  const router = useRouter();
  const { language: appLanguage, setLanguage: setAppLanguage } = useAppLanguage();
  const [screen, setScreen] = useState<Screen>(initialAuthScreen || "splash");
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeFocused, setCodeFocused] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [codeDelivery, setCodeDelivery] = useState<"email" | "phone">("email");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState<"woman" | "man" | "">("");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [authNotice, setAuthNotice] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [enabledProviders, setEnabledProviders] = useState({ email: true, phone: false, google: false, apple: false });
  const language = appLanguage === "th" ? languages[1] : languages[0];
  const [selectedInterests, setSelectedInterests] = useState<string[]>(["Music", "Travel", "Community"]);
  const [radius, setRadius] = useState(25);
  const [city, setCity] = useState("Koh Phangan");
  const [location, setLocation] = useState({ lat: 9.725, lon: 100.01 });
  const [locationStatus, setLocationStatus] = useState("We’ll ask for your location when you reach this step.");
  const [notifications, setNotifications] = useState(notificationOptions.map(() => true));
  const [pushStatus, setPushStatus] = useState<"idle" | "requesting" | "done">("idle");

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (screen !== "splash") return;
    const timer = window.setTimeout(async () => {
      if (hasSupabaseConfig) {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          window.localStorage.setItem("attnd:user-id", data.user.id);
          const { data: profile } = await supabase.from("profiles").select("onboarding_complete").eq("id", data.user.id).maybeSingle();
          if (profile?.onboarding_complete) { router.replace(requestedReturnPath()); return; }
          setStep(1);
          setScreen("profile");
          return;
        }
      }
      setScreen("welcome");
    }, 1350);
    return () => window.clearTimeout(timer);
  }, [router, screen]);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    const { url, key } = requireSupabaseConfig();
    let active = true;
    void fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((response) => response.ok ? response.json() : null)
      .then((settings: { external?: Partial<typeof enabledProviders> } | null) => {
        if (active && settings?.external) setEnabledProviders({
          email: settings.external.email === true,
          phone: settings.external.phone === true,
          google: settings.external.google === true,
          apple: settings.external.apple === true,
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const applyLocation = useCallback((latitude: number, longitude: number) => {
    setLocation({ lat: latitude, lon: longitude });
    const distanceFromKohPhangan = Math.hypot((latitude - 9.725) * 111, (longitude - 100.01) * 109);
    setCity(distanceFromKohPhangan < 100 ? "Koh Phangan" : "Your location");
    setLocationStatus("Location detected from your device.");
  }, []);

  useEffect(() => {
    const receiveNativeLocation = (event: Event) => {
      const detail = (event as CustomEvent<{ latitude?: number; longitude?: number; error?: string }>).detail;
      if (detail.error || detail.latitude === undefined || detail.longitude === undefined) {
        setLocationStatus("Location access was not granted. Open iOS Settings to allow access, or enter your city.");
        return;
      }
      applyLocation(detail.latitude, detail.longitude);
    };
    window.addEventListener("attnd-native-location", receiveNativeLocation);
    return () => window.removeEventListener("attnd-native-location", receiveNativeLocation);
  }, [applyLocation]);

  const completeSignIn = useCallback(async (userId: string) => {
    window.localStorage.setItem("attnd:user-id", userId);
    const { data: profile } = await createClient().from("profiles").select("onboarding_complete").eq("id", userId).maybeSingle();
    if (profile?.onboarding_complete) router.replace(requestedReturnPath());
    else { setStep(1); setScreen("profile"); }
  }, [router]);
  useEffect(() => {
    const receiveNativeSocialAuth = (event: Event) => {
      const detail = (event as CustomEvent<{ callbackURL?: string; error?: string }>).detail;
      if (detail.error) { setAuthNotice(detail.error); setAuthPending(false); return; }
      void (async () => {
        try {
          const callback = new URL(detail.callbackURL || "");
          if (callback.protocol !== "com.ninjaworld.attndr:" || callback.hostname !== "auth") throw new Error("Invalid sign-in callback.");
          const code = callback.searchParams.get("code");
          if (!code) throw new Error(callback.searchParams.get("error_description") || "Sign-in did not return a code.");
          const { data, error } = await createClient().auth.exchangeCodeForSession(code);
          if (error || !data.user) throw error || new Error("Sign-in could not be completed.");
          await completeSignIn(data.user.id);
        } catch (error) {
          setAuthNotice(error instanceof Error ? error.message : "Sign-in could not be completed.");
        } finally {
          setAuthPending(false);
        }
      })();
    };
    window.addEventListener("attnd-native-social-auth", receiveNativeSocialAuth);
    return () => window.removeEventListener("attnd-native-social-auth", receiveNativeSocialAuth);
  }, [completeSignIn]);
  const requestNotificationPermission = useCallback(async () => {
    const nativeHandler = (window as Window & { webkit?: { messageHandlers?: { attndNotificationPermission?: { postMessage: (value: unknown) => void } } } }).webkit?.messageHandlers?.attndNotificationPermission;
    if (nativeHandler) {
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(() => { window.removeEventListener("attnd-native-notifications", receive); resolve(); }, 12000);
        const receive = () => {
          window.clearTimeout(timeout);
          window.removeEventListener("attnd-native-notifications", receive);
          resolve();
        };
        window.addEventListener("attnd-native-notifications", receive);
        nativeHandler.postMessage({ action: "request" });
      });
      return;
    }
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
  }, []);

  useEffect(() => {
    const register = (event: Event) => {
      const detail = (event as CustomEvent<{ token?: string; environment?: "development" | "production" }>).detail;
      if (!detail.token) return;
      void fetch("/api/push/devices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: detail.token, platform: "ios", environment: detail.environment || "production" }) });
    };
    window.addEventListener("attnd-native-push-token", register);
    return () => window.removeEventListener("attnd-native-push-token", register);
  }, []);
  const finish = async () => {
    window.localStorage.setItem("attnd:user-gender", gender || "woman");
    if (hasSupabaseConfig) {
      setAuthPending(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthNotice("Please sign in before completing your profile."); setScreen("login"); setAuthPending(false); return; }
      window.localStorage.setItem("attnd:user-id", user.id);
      let avatarUrl: string | null = null;
      if (profilePhotoFile) {
        const extension = profilePhotoFile.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from("avatars").upload(path, profilePhotoFile, { contentType: profilePhotoFile.type, upsert: false });
        if (!error) avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("profiles").upsert({
        id: user.id, first_name: firstName.trim(), username: username.trim().replace(/^@/, ""), gender: gender || "woman",
        avatar_url: avatarUrl, city, latitude: location.lat, longitude: location.lon, search_radius_km: radius,
        language: appLanguage === "th" ? "ภาษาไทย" : "English", interests: selectedInterests, onboarding_complete: true, updated_at: new Date().toISOString(),
      });
      if (error) { setAuthNotice(error.message); setAuthPending(false); return; }
      await fetch("/api/affiliates/referral", { method: "POST" }).catch(() => {});
      setAuthPending(false);
    }
    if (notifications.some(Boolean)) await requestNotificationPermission();
    router.push(requestedReturnPath());
  };
  const requestLocation = () => {
    const nativeHandler = (window as Window & { webkit?: { messageHandlers?: { attndLocationPermission?: { postMessage: (value: unknown) => void } } } }).webkit?.messageHandlers?.attndLocationPermission;
    if (nativeHandler) {
      setLocationStatus("Waiting for iOS location permission…");
      nativeHandler.postMessage({ action: "request" });
      return;
    }
    if (!("geolocation" in navigator)) {
      setLocationStatus("Location is not available on this device.");
      return;
    }
    setLocationStatus("Waiting for location permission…");
    navigator.geolocation.getCurrentPosition(({ coords }) => applyLocation(coords.latitude, coords.longitude), () => setLocationStatus("Location access was not granted. You can enter your city instead."), { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 });
  };
  const next = () => {
    if (step === 6) { void finish(); return; }
    if (step === 4) requestLocation();
    setStep((value) => value + 1);
  };
  const previous = () => step === 1 ? setScreen("login") : setStep((value) => value - 1);
  const submitEmail = async (event: FormEvent) => {
    event.preventDefault(); if (!email) return;
    if (!hasSupabaseConfig) { setAuthNotice("Supabase credentials are required before login can be used."); return; }
    setAuthPending(true); setAuthNotice("");
    const { error } = await createClient().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    if (error) {
      const rateLimited = error.message.toLowerCase().includes("rate") || error.status === 429;
      setAuthNotice(rateLimited ? "Too many email attempts. Please wait one minute before trying again." : error.message);
      if (rateLimited) setResendCooldown(60);
    } else { setCode(""); setCodeDelivery("email"); setResendCooldown(60); setScreen("code"); }
    setAuthPending(false);
  };
  const submitPassword = async (event: FormEvent) => {
    event.preventDefault(); if (!email || !password) return;
    if (!hasSupabaseConfig) { setAuthNotice("Supabase credentials are required before login can be used."); return; }
    setAuthPending(true); setAuthNotice("");
    const { data, error } = await createClient().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (!error && data.user) { setPassword(""); await completeSignIn(data.user.id); }
    else setAuthNotice(error?.message === "Invalid login credentials" ? "Email or password is incorrect. You can also log in with a one-time code." : error?.message || "Login failed. Please try again.");
    setAuthPending(false);
  };
  const submitPhone = async (event: FormEvent) => {
    event.preventDefault(); if (!phone) return;
    if (!hasSupabaseConfig) { setAuthNotice("Supabase credentials are required before login can be used."); return; }
    setAuthPending(true); setAuthNotice("");
    const { error } = await createClient().auth.signInWithOtp({ phone });
    if (!error) { setCode(""); setCodeDelivery("phone"); setScreen("code"); } else setAuthNotice(error.message);
    setAuthPending(false);
  };
  const submitCode = async (event: FormEvent) => {
    event.preventDefault(); if (code.length !== 6 || !hasSupabaseConfig) return;
    setAuthPending(true); setAuthNotice("");
    const { data, error } = codeDelivery === "email"
      ? await createClient().auth.verifyOtp({ email: email.trim(), token: code, type: "email" })
      : await createClient().auth.verifyOtp({ phone, token: code, type: "sms" });
    if (!error && data.user) await completeSignIn(data.user.id);
    else setAuthNotice(error?.message || "Verification failed. Please try again.");
    setAuthPending(false);
  };
  const resendCode = async () => {
    if (resendCooldown > 0) return;
    setAuthPending(true); setAuthNotice("");
    const { error } = codeDelivery === "email"
      ? await createClient().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
      : await createClient().auth.signInWithOtp({ phone });
    const rateLimited = Boolean(error && (error.message.toLowerCase().includes("rate") || error.status === 429));
    setAuthNotice(error ? (rateLimited ? "Too many email attempts. Please wait one minute before trying again." : error.message) : "A new code is on its way.");
    setResendCooldown(60);
    setAuthPending(false);
  };
  const pasteCode = async () => {
    try {
      const pasted = (await navigator.clipboard.readText()).replace(/\D/g, "").slice(0, 6);
      if (!pasted) { setAuthNotice("No verification code found in your clipboard."); return; }
      setCode(pasted);
      setAuthNotice("");
      codeInputRef.current?.focus();
    } catch {
      setAuthNotice("Tap a code box and paste the code from your keyboard.");
      codeInputRef.current?.focus();
    }
  };
  const signInWithProvider = async (provider: "google" | "apple") => {
    if (!hasSupabaseConfig) { setAuthNotice("Supabase credentials are required before login can be used."); return; }
    setAuthPending(true); setAuthNotice("");
    const nativeHandler = (window as Window & { webkit?: { messageHandlers?: { attndSocialAuth?: { postMessage: (value: unknown) => void } } } }).webkit?.messageHandlers?.attndSocialAuth;
    const afterAuth = `/onboarding?profile=1&next=${encodeURIComponent(requestedReturnPath())}`;
    const redirectTo = nativeHandler ? "com.ninjaworld.attndr://auth/callback" : `${window.location.origin}/auth/callback?next=${encodeURIComponent(afterAuth)}`;
    const { data, error } = await createClient().auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: Boolean(nativeHandler) } });
    if (error) { setAuthNotice(error.message); setAuthPending(false); return; }
    if (nativeHandler && data.url) nativeHandler.postMessage({ url: data.url });
    else if (nativeHandler) { setAuthNotice("Sign-in could not be started."); setAuthPending(false); }
  };
  const chooseProfilePhoto = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setProfilePhotoFile(file);
    setProfilePhoto((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  };

  if (screen === "splash") return (
    <section className="onboarding-splash" aria-label="Attnd is starting">
      <Image src="/brand/attnd-logo-serif-white.png" alt="Attnd" width={1774} height={887} priority />
    </section>
  );

  if (screen === "welcome") return (
    <section className="onboarding-welcome">
      <div className="onboarding-welcome-content">
        <div className="onboarding-language-switch" role="group" aria-label="App Language">
          <button type="button" aria-pressed={appLanguage === "en"} onClick={() => setAppLanguage("en")}>EN</button>
          <button type="button" aria-pressed={appLanguage === "th"} onClick={() => setAppLanguage("th")}>ไทย</button>
        </div>
        <div className="onboarding-welcome-brand"><AttndLogo /></div>
        <div className="onboarding-welcome-copy">
          <h1>Find your people.<br />Join the moment.</h1>
        </div>
        <div className="onboarding-welcome-actions">
          <PrimaryButton onClick={() => { setAuthNotice(""); setScreen("signup"); }}>Get Started</PrimaryButton>
          <button type="button" className="onboarding-secondary" onClick={() => { setAuthNotice(""); setScreen("login"); }}>I already have an account</button>
        </div>
      </div>
    </section>
  );

  if (screen === "login") return (
    <section className="onboarding-screen onboarding-login">
      <BackButton onClick={() => setScreen("welcome")} /><AttndLogo compact />
      <div className="onboarding-login-body">
        <h1>Welcome back</h1><p>Log in to your account</p>
        <div className="onboarding-methods">
          {enabledProviders.email && <button type="button" onClick={() => { setAuthMode("login"); setAuthNotice(""); setScreen("email"); }}><Icon name="mail" /><span><b>Continue with Email</b><small>Receive a one-time code</small></span></button>}
          {enabledProviders.email && <button type="button" onClick={() => { setAuthMode("login"); setAuthNotice(""); setScreen("password"); }}><Icon name="mail" /><span><b>Email &amp; password</b><small>Log in with your password</small></span></button>}
          {enabledProviders.phone && <button type="button" onClick={() => setScreen("phone")}><Icon name="phone" /><span><b>Continue with Phone</b><small>Receive a one-time code</small></span></button>}
          {enabledProviders.google && <button type="button" onClick={() => void signInWithProvider("google")} disabled={authPending}><Icon name="google" /><span><b>Continue with Google</b></span></button>}
          {enabledProviders.apple && <button type="button" onClick={() => void signInWithProvider("apple")} disabled={authPending}><Icon name="apple" /><span><b>Continue with Apple</b></span></button>}
        </div>
        <div className="onboarding-or"><span>or</span></div>
        <button type="button" className="onboarding-link" onClick={() => { setAuthNotice(""); setScreen("signup"); }}>Create a new account</button>
        {authNotice && <p role="status" className="onboarding-field-note">{authNotice}</p>}
      </div>
      <p className="onboarding-terms">By continuing, you agree to our<br /><Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
    </section>
  );

  if (screen === "signup") return (
    <section className="onboarding-screen onboarding-login">
      <BackButton onClick={() => setScreen("login")} /><AttndLogo compact />
      <div className="onboarding-login-body">
        <h1>Create your account</h1><p>Join Attnd to find your people and events</p>
        <div className="onboarding-methods">
          {enabledProviders.email && <button type="button" onClick={() => { setAuthMode("signup"); setAuthNotice(""); setScreen("email"); }}><Icon name="mail" /><span><b>Sign up with Email</b><small>Get a code to create your account</small></span></button>}
          {enabledProviders.google && <button type="button" onClick={() => void signInWithProvider("google")} disabled={authPending}><Icon name="google" /><span><b>Sign up with Google</b></span></button>}
          {enabledProviders.apple && <button type="button" onClick={() => void signInWithProvider("apple")} disabled={authPending}><Icon name="apple" /><span><b>Sign up with Apple</b></span></button>}
        </div>
        <div className="onboarding-or"><span>or</span></div>
        <button type="button" className="onboarding-link" onClick={() => { setAuthNotice(""); setScreen("login"); }}>I already have an account</button>
        {authNotice && <p role="status" className="onboarding-field-note">{authNotice}</p>}
      </div>
      <p className="onboarding-terms">By continuing, you agree to our<br /><Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
    </section>
  );

  if (screen === "email") return (
    <AuthScreen icon="mail" title={authMode === "signup" ? "Create your account" : "Log in with Email"} subtitle="We’ll send you a 6-digit code to enter here." back={() => { setAuthNotice(""); setScreen(authMode); }}>
      <form onSubmit={submitEmail} className="onboarding-auth-form">
        <label><Icon name="mail" /><input type="email" autoComplete="email" placeholder="youremail@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
        {authNotice && <p role="status" className="onboarding-field-note">{authNotice}</p>}
        <PrimaryButton type="submit" disabled={!email || authPending}>{authPending ? "Sending…" : "Send Code"}</PrimaryButton>
      </form>
    </AuthScreen>
  );

  if (screen === "password") return (
    <AuthScreen icon="mail" title="Log in with password" subtitle="Use the password you set in Login & security." back={() => { setAuthNotice(""); setScreen("login"); }}>
      <form onSubmit={submitPassword} className="onboarding-auth-form">
        <label><Icon name="mail" /><input type="email" autoComplete="username" placeholder="youremail@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
        <label><Icon name="mail" /><input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {authNotice && <p role="status" className="onboarding-field-note">{authNotice}</p>}
        <PrimaryButton type="submit" disabled={!email || !password || authPending}>{authPending ? "Logging in…" : "Log in"}</PrimaryButton>
        <button type="button" className="onboarding-link" onClick={() => { setAuthNotice(""); setScreen("email"); }}>Forgot password? Get a one-time code</button>
      </form>
    </AuthScreen>
  );

  if (screen === "phone") return (
    <AuthScreen icon="phone" title="Login with Phone" subtitle="We’ll send you a 6-digit code via SMS." back={() => setScreen("login")}>
      <form onSubmit={submitPhone} className="onboarding-auth-form">
        <div className="onboarding-phone-row"><span>🇩🇪 +49⌄</span><input inputMode="tel" placeholder="1512 3456789" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus /></div>
        <PrimaryButton type="submit" disabled={!phone || authPending}>{authPending ? "Sending…" : "Send Code"}</PrimaryButton>
        {authNotice && <p role="status" className="onboarding-field-note">{authNotice}</p>}
      </form>
    </AuthScreen>
  );

  if (screen === "code") return (
    <AuthScreen icon={codeDelivery === "email" ? "mail" : "phone"} title="Enter the code" subtitle={`We sent a 6-digit code to ${codeDelivery === "email" ? email : phone}`} back={() => { setAuthNotice(""); setScreen(codeDelivery); }}>
      <form onSubmit={submitCode} className="onboarding-code-form">
        <div className="onboarding-code-entry" onClick={() => codeInputRef.current?.focus()}>
          <input ref={codeInputRef} type="text" aria-label="Six digit verification code" inputMode="numeric" autoComplete="one-time-code" autoCorrect="off" spellCheck={false} pattern="[0-9]*" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onPaste={(e) => { e.preventDefault(); setCode(e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)); setAuthNotice(""); }} onFocus={() => setCodeFocused(true)} onBlur={() => setCodeFocused(false)} autoFocus />
          <div className="onboarding-code-boxes" aria-hidden="true">{Array.from({ length: 6 }).map((_, index) => <span key={index} className={codeFocused && index === Math.min(code.length, 5) ? "active" : ""}>{code[index] || ""}</span>)}</div>
        </div>
        <button type="button" className="onboarding-paste-code" onClick={() => void pasteCode()}>Paste code</button>
        <p>Didn’t receive a code? <button type="button" onClick={() => void resendCode()} disabled={authPending || resendCooldown > 0}>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend"}</button></p>
        {authNotice && <p role="status" className="onboarding-field-note">{authNotice}</p>}
        <PrimaryButton type="submit" disabled={code.length !== 6 || authPending}>{authPending ? "Checking…" : "Continue"}</PrimaryButton>
      </form>
    </AuthScreen>
  );

  return (
    <section className="onboarding-screen onboarding-profile">
      <BackButton onClick={previous} />
      <div className="onboarding-progress"><span>Step {step} of 6</span><div>{Array.from({ length: 6 }).map((_, index) => <i key={index} className={index < step ? "complete" : ""} />)}</div></div>
      <div className="onboarding-step-content">
        {step === 1 && <><header><h1>What should we call you?</h1><p>Add your first name, username and gender for relevant event recommendations.</p></header><div className="onboarding-fields"><label><Icon name="user" /><span><small>First name</small><input value={firstName} minLength={3} maxLength={40} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" /></span></label><label><Icon name="user" /><span><small>Username</small><input value={username} minLength={3} maxLength={24} autoCapitalize="none" autoCorrect="off" onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))} placeholder="@username" /></span></label></div><p className="onboarding-field-note">First name and username need at least 3 characters.</p><div className="onboarding-gender"><span>I am</span><div>{([['woman','Woman'],['man','Man']] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={gender === value} onClick={() => { setGender(value); window.localStorage.setItem("attnd:user-gender", value); }}>{label}</button>)}</div></div></>}
        {step === 2 && <><header><h1>Add a profile photo</h1><p>Choose a photo from your device. You can change it later.</p></header><div className={`onboarding-photo${profilePhoto ? " has-photo" : ""}`}><label aria-label="Upload profile photo">{profilePhoto ? <Image src={profilePhoto} alt="Your profile preview" width={174} height={174} unoptimized /> : <span><Icon name="camera" size={34} /><b>Choose photo</b></span>}<input type="file" accept="image/*" onChange={(event) => { chooseProfilePhoto(event.target.files); event.currentTarget.value = ""; }} /><i><Icon name="camera" /></i></label></div></>}
        {step === 3 && <><header><h1>Choose your language</h1><p>You can change this later in your profile.</p></header><div className="onboarding-choice-list">{languages.map((item) => <button type="button" key={item} className={language === item ? "selected" : ""} onClick={() => setAppLanguage(item === languages[1] ? "th" : "en")}><span>{item}</span><i /></button>)}</div></>}
        {step === 4 && <><header><h1>What interests you?</h1><p>Select a few topics to get personalized event recommendations.</p></header><div className="onboarding-interests">{interests.map((item) => <button type="button" key={item} className={selectedInterests.includes(item) ? "selected" : ""} onClick={() => setSelectedInterests((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])}>{item}</button>)}</div></>}
        {step === 5 && <><header><h1>Where are you?</h1><p>Allow location access to find nearby events and set your search area.</p></header><label className="onboarding-location"><Icon name="pin" /><input list="onboarding-cities" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Enter a city" /><datalist id="onboarding-cities"><option value="Koh Phangan" /></datalist><button type="button" aria-label="Use my current location" onClick={requestLocation}>⌁</button></label><small className="onboarding-location-note">{locationStatus}</small><div className="onboarding-radius"><div><span>Show events within</span><b>{radius} km</b></div><input type="range" min="5" max="100" step="5" value={radius} onChange={(e) => setRadius(Number(e.target.value))} /><div className="onboarding-range-labels"><span>5 km</span><span>25 km</span><span>50 km</span><span>100 km</span></div></div><OnboardingLocationMap radius={radius} center={location} /></>}
        {step === 6 && <><header><h1>Stay in the loop</h1><p>Get notified about events, invites and important updates.</p></header><div className="onboarding-notifications">{notificationOptions.map(([title, subtitle], index) => <button type="button" key={title} onClick={() => setNotifications((current) => current.map((value, i) => i === index ? !value : value))}><Icon name={index === 2 ? "user" : index === 3 ? "bell" : index === 0 ? "mail" : "phone"} /><span><b>{title}</b><small>{subtitle}</small></span><i className={notifications[index] ? "on" : ""} /></button>)}</div><button type="button" className="onboarding-push-optin" disabled={pushStatus === "requesting"} onClick={() => { setPushStatus("requesting"); void requestNotificationPermission().then(() => setPushStatus("done")); }}><Icon name="bell" /><span><b>{pushStatus === "done" ? "Push notifications set up" : "Allow push notifications"}</b><small>Ticket reminders, invites and live updates on this device.</small></span></button></>}
      </div>
      <div className="onboarding-step-action"><PrimaryButton onClick={next} disabled={authPending || (step === 1 && (firstName.trim().length < 3 || username.trim().length < 3 || !gender))}>{step === 6 ? (authPending ? "Saving…" : "Finish") : "Next"}</PrimaryButton>{step === 2 && <button type="button" className="onboarding-link" onClick={next}>Skip for now</button>}{authNotice && <p role="status" className="onboarding-field-note">{authNotice}</p>}</div>
    </section>
  );
}

function OnboardingLocationMap({ radius, center }: { radius: number; center: { lat: number; lon: number } }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const radiusRef = useRef<Circle | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const initialRadiusRef = useRef(radius);
  const initialCenterRef = useRef(center);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    void import("leaflet").then((L) => {
      if (cancelled) return;
      const initialCenter = L.latLng(initialCenterRef.current.lat, initialCenterRef.current.lon);
      const map = L.map(container, { attributionControl: true, zoomControl: true, minZoom: 7, maxZoom: 17 }).setView(initialCenter, 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19, crossOrigin: true }).addTo(map);
      const marker = L.circleMarker(initialCenter, { radius: 6, color: "#ffffff", weight: 2, fillColor: "#ffffff", fillOpacity: 1 }).addTo(map);
      const circle = L.circle(initialCenter, { radius: initialRadiusRef.current * 1000, color: "#ffffff", weight: 2, fillColor: "#ffffff", fillOpacity: .14 }).addTo(map);
      map.fitBounds(circle.getBounds(), { padding: [12, 12], maxZoom: 13, animate: false });
      mapRef.current = map;
      radiusRef.current = circle;
      markerRef.current = marker;
      setMapReady(true);
      observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      observer.observe(container);
      window.setTimeout(() => map.invalidateSize({ pan: false }), 0);
    });
    return () => { cancelled = true; observer?.disconnect(); mapRef.current?.remove(); mapRef.current = null; radiusRef.current = null; markerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const circle = radiusRef.current;
    if (!map || !circle) return;
    circle.setRadius(radius * 1000);
    map.fitBounds(circle.getBounds(), { padding: [12, 12], maxZoom: 13, animate: true });
  }, [radius, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const circle = radiusRef.current;
    const marker = markerRef.current;
    if (!map || !circle || !marker) return;
    const nextCenter = { lat: center.lat, lng: center.lon };
    circle.setLatLng(nextCenter);
    marker.setLatLng(nextCenter);
    map.fitBounds(circle.getBounds(), { padding: [12, 12], maxZoom: 13, animate: true });
  }, [center]);

  return <div className="onboarding-map"><div ref={containerRef} aria-label={`Interactive OpenStreetMap showing a ${radius} kilometer radius around Koh Phangan`} /><span>{radius} km</span></div>;
}

function AuthScreen({ icon, title, subtitle, back, children }: { icon: "mail" | "phone"; title: string; subtitle: string; back: () => void; children: ReactNode }) {
  return <section className="onboarding-screen onboarding-auth"><BackButton onClick={back} /><AttndLogo compact /><div className="onboarding-auth-body"><div className="onboarding-auth-icon"><Icon name={icon} size={28} /></div><h1>{title}</h1><p>{subtitle}</p>{children}</div></section>;
}
