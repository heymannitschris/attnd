import { sendEmail } from "@/lib/email";
import { moderationReportEmail } from "@/lib/emails/templates";
import { getAppUrl } from "@/lib/stripe";
import { SUPPORT_EMAIL } from "@/lib/support";

type ReportMail = { request: Request; targetType: string; targetId: string; reason: string; reporterId: string; path: string };

/** Notify the moderation inbox about a new report. Never throws: a mail failure must not block the report. */
export async function notifyModeration({ request, targetType, targetId, reason, reporterId, path }: ReportMail) {
  try {
    const appUrl = getAppUrl(request);
    const link = `${appUrl}${path}`;
    const mail = moderationReportEmail({ targetType, reason, targetId, reporterId, link, adminUrl: `${appUrl}/admin` });
    const result = await sendEmail({ to: SUPPORT_EMAIL, subject: mail.subject, html: mail.html, text: mail.text });
    if (!result.sent) console.error("Report mail not sent:", result.reason);
  } catch (error) {
    console.error("Report mail failed:", error);
  }
}
