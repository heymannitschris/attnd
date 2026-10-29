"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";
import { notificationSettings } from "@/lib/mock-notifications";
import { NotificationIcon } from "./NotificationIcon";

export function NotificationSettingsScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [enabled, setEnabled] = useState(() => new Set(notificationSettings.map((item) => item.id)));
  const [notice, setNotice] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  useEffect(() => {
    const receiveToken = async (event: Event) => {
      const detail = (event as CustomEvent<{ token?: string; environment?: "development" | "production" }>).detail;
      if (!detail.token) return;
      const response = await fetch("/api/push/devices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: detail.token, platform: "ios", environment: detail.environment || "production" }) });
      setDeviceRegistered(response.ok);
      setNotice(response.ok ? "This iPhone is ready for push notifications." : "Push registration failed. Please try again.");
    };
    const receivePermission = (event: Event) => {
      const detail = (event as CustomEvent<{ granted?: boolean; registering?: boolean }>).detail;
      if (detail.granted && detail.registering) setNotice("Registering this iPhone…");
      else if (!detail.granted) setNotice("Push permission was not granted in iOS Settings.");
    };
    window.addEventListener("attnd-native-push-token", receiveToken);
    window.addEventListener("attnd-native-notifications", receivePermission);
    void fetch("/api/notifications/preferences").then(async (response) => response.ok ? response.json() : null).then((result: { preferences?: Record<string, boolean> } | null) => { if (result?.preferences) { setEnabled(new Set(notificationSettings.filter((item) => result.preferences?.[item.id] !== false).map((item) => item.id))); setPushEnabled(result.preferences.push_enabled !== false); setEmailEnabled(result.preferences.email_enabled === true); } });
    void fetch("/api/push/devices").then(async (response) => response.ok ? response.json() : null).then((result: { registered?: boolean } | null) => setDeviceRegistered(result?.registered === true));
    const nativeHandler = (window as Window & { webkit?: { messageHandlers?: { attndNotificationPermission?: { postMessage: (value: unknown) => void } } } }).webkit?.messageHandlers?.attndNotificationPermission;
    nativeHandler?.postMessage({ action: "getToken" });
    return () => {
      window.removeEventListener("attnd-native-push-token", receiveToken);
      window.removeEventListener("attnd-native-notifications", receivePermission);
    };
  }, []);
  function save(next: Set<string>, channels = { push: pushEnabled, email: emailEnabled }) { void fetch("/api/notifications/preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ preferences: { ...Object.fromEntries(notificationSettings.map((item) => [item.id, next.has(item.id)])), push_enabled: channels.push, email_enabled: channels.email } }) }); }
  function toggle(id: string) { setEnabled((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); save(next); return next; }); }
  function togglePush() {
    const next = !pushEnabled; setPushEnabled(next);
    save(enabled, { push: next, email: emailEnabled });
    if (next) {
      const nativeHandler = (window as Window & { webkit?: { messageHandlers?: { attndNotificationPermission?: { postMessage: (value: unknown) => void } } } }).webkit?.messageHandlers?.attndNotificationPermission;
      if (nativeHandler) nativeHandler.postMessage({ action: "request" });
      else if ("Notification" in window) void Notification.requestPermission().then((permission) => setNotice(permission === "granted" ? "Browser notifications enabled" : "Notification permission was not granted"));
    } else setNotice("Push notifications disabled in Attnd. You can also disable them in iOS Settings.");
  }
  function toggleEmail() {
    const next = !emailEnabled; setEmailEnabled(next); save(enabled, { push: pushEnabled, email: next });
    setNotice(next ? "Email notifications enabled" : "Email notifications disabled");
  }
  async function sendTestPush() {
    setSendingTest(true);
    setNotice("");
    try {
      if (!deviceRegistered) {
        const nativeHandler = (window as Window & { webkit?: { messageHandlers?: { attndNotificationPermission?: { postMessage: (value: unknown) => void } } } }).webkit?.messageHandlers?.attndNotificationPermission;
        nativeHandler?.postMessage({ action: "getToken" });
        setNotice(nativeHandler ? "Registering this iPhone. Try the test again in a moment." : "Open Attnd on your iPhone and enable Push Notifications first.");
        return;
      }
      const response = await fetch("/api/push/test", { method: "POST" });
      const result = await response.json() as { sent?: number; error?: string };
      setNotice(response.ok ? "Test notification sent to your iPhone." : result.error || "Test notification could not be sent.");
    } catch {
      setNotice("Test notification could not be sent.");
    } finally {
      setSendingTest(false);
    }
  }
  return <div className="notification-settings-screen">
    <header className="notification-settings-header"><Link href="/notifications" aria-label="Back to notifications"><DiscoverIcon name="chevron" /></Link><h1>Notification Settings</h1></header>
    <section className="notification-master"><NotificationIcon name="bell" /><div><strong>Push Notifications</strong><span>Receive notifications on your device</span></div><Toggle checked={pushEnabled} label="Push Notifications" onClick={togglePush} /></section>
    {pushEnabled && <button type="button" className="notification-test-push" disabled={sendingTest} onClick={() => void sendTestPush()}>{sendingTest ? "Sending test…" : deviceRegistered ? "Send test notification" : "Register this iPhone"}</button>}
    <section className="notification-master"><NotificationIcon name="mail" /><div><strong>Email Notifications</strong><span>Receive the selected updates by email</span></div><Toggle checked={emailEnabled} label="Email Notifications" onClick={toggleEmail} /></section>
    <h2>Notify me about</h2>
    <section className="notification-setting-list">{notificationSettings.map((item) => <div key={item.id} className="notification-setting-row"><NotificationIcon name={item.icon} /><div><strong>{item.title}</strong><span>{item.description}</span></div><Toggle checked={enabled.has(item.id)} label={item.title} onClick={() => toggle(item.id)} /></div>)}</section>
    {notice && <p role="status" className="notification-settings-notice">{notice}</p>}
  </div>;
}

function Toggle({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onClick} className="notification-toggle"><span /></button>;
}
