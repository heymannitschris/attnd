import { createAdminClient } from "@/lib/supabase/admin";
import { sendApns } from "@/lib/apns";
import { sendEmail } from "@/lib/email";
import { notificationEmail } from "@/lib/emails/templates";

export async function notifyUsers(userIds: string[], notification: { category: string; title: string; body: string; href?: string; metadata?: Record<string, unknown>; preference?: string; /** Set false when the caller sends its own dedicated email for this event. */ email?: boolean }) {
  if (!userIds.length) return;
  const admin = createAdminClient();
  const preferenceKey = notification.preference || (notification.category === "Affiliates" ? "earnings" : notification.category === "Tickets" ? "transfers" : "invites");
  const { data: profiles } = await admin.from("profiles").select("id,notification_preferences").in("id", userIds);
  const eligibleProfiles = (profiles || []).filter((profile) => (profile.notification_preferences as Record<string, boolean> | null)?.[preferenceKey] !== false);
  const recipients = eligibleProfiles.map((profile) => profile.id);
  if (!recipients.length) return;
  const { preference: _preference, email: _email, ...storedNotification } = notification;
  void _preference; void _email;
  await admin.from("notifications").insert(recipients.map((userId) => ({ user_id: userId, ...storedNotification })));
  const pushRecipients = eligibleProfiles.filter((profile) => (profile.notification_preferences as Record<string, boolean> | null)?.push_enabled !== false).map((profile) => profile.id);
  const { data: devices } = pushRecipients.length ? await admin.from("push_devices").select("token, environment").in("user_id", pushRecipients).eq("enabled", true) : { data: [] };
  await Promise.allSettled((devices ?? []).map((device) => sendApns(device.token, device.environment, notification)));
  const emailRecipients = notification.email === false ? [] : eligibleProfiles.filter((profile) => (profile.notification_preferences as Record<string, boolean> | null)?.email_enabled === true);
  const siteUrl = "https://www.attnd.space";
  const target = notification.href ? new URL(notification.href, siteUrl).toString().replace(/^https:\/\/event-platform-mobile(?:-[^.]+)?\.vercel\.app/, siteUrl) : siteUrl;
  await Promise.allSettled(emailRecipients.map(async (profile) => {
    const { data } = await admin.auth.admin.getUserById(profile.id);
    if (!data.user?.email) return;
    const mail = notificationEmail({ title: notification.title, body: notification.body, href: target });
    await sendEmail({ to: data.user.email, subject: mail.subject, html: mail.html, text: mail.text });
  }));
}
