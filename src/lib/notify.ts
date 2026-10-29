import { createAdminClient } from "@/lib/supabase/admin";
import { sendApns } from "@/lib/apns";
import { escapeHtml, sendEmail } from "@/lib/email";

export async function notifyUsers(userIds: string[], notification: { category: string; title: string; body: string; href?: string; metadata?: Record<string, unknown>; preference?: string }) {
  if (!userIds.length) return;
  const admin = createAdminClient();
  const preferenceKey = notification.preference || (notification.category === "Affiliates" ? "earnings" : notification.category === "Tickets" ? "transfers" : "invites");
  const { data: profiles } = await admin.from("profiles").select("id,notification_preferences").in("id", userIds);
  const eligibleProfiles = (profiles || []).filter((profile) => (profile.notification_preferences as Record<string, boolean> | null)?.[preferenceKey] !== false);
  const recipients = eligibleProfiles.map((profile) => profile.id);
  if (!recipients.length) return;
  const { preference: _preference, ...storedNotification } = notification;
  void _preference;
  await admin.from("notifications").insert(recipients.map((userId) => ({ user_id: userId, ...storedNotification })));
  const pushRecipients = eligibleProfiles.filter((profile) => (profile.notification_preferences as Record<string, boolean> | null)?.push_enabled !== false).map((profile) => profile.id);
  const { data: devices } = pushRecipients.length ? await admin.from("push_devices").select("token, environment").in("user_id", pushRecipients).eq("enabled", true) : { data: [] };
  await Promise.allSettled((devices ?? []).map((device) => sendApns(device.token, device.environment, notification)));
  const emailRecipients = eligibleProfiles.filter((profile) => (profile.notification_preferences as Record<string, boolean> | null)?.email_enabled === true);
  const siteUrl = "https://www.attnd.space";
  const target = notification.href ? new URL(notification.href, siteUrl).toString().replace(/^https:\/\/event-platform-mobile(?:-[^.]+)?\.vercel\.app/, siteUrl) : siteUrl;
  await Promise.allSettled(emailRecipients.map(async (profile) => {
    const { data } = await admin.auth.admin.getUserById(profile.id);
    if (!data.user?.email) return;
    await sendEmail({ to: data.user.email, subject: notification.title, html: `<h1>${escapeHtml(notification.title)}</h1><p>${escapeHtml(notification.body)}</p><p><a href="${escapeHtml(target)}">Open Attnd</a></p>` });
  }));
}
