import { escapeHtml, sendEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/stripe";
import { SUPPORT_EMAIL } from "@/lib/support";

type ReportMail = { request: Request; targetType: string; targetId: string; reason: string; reporterId: string; path: string };

/** Notify the moderation inbox about a new report. Never throws: a mail failure must not block the report. */
export async function notifyModeration({ request, targetType, targetId, reason, reporterId, path }: ReportMail) {
  try {
    const appUrl = getAppUrl(request);
    const link = `${appUrl}${path}`;
    const result = await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `[Attnd report] ${targetType}: ${reason}`.slice(0, 140),
      html: `<h2>New Attnd report (review within 24h)</h2><p><strong>Type:</strong> ${escapeHtml(targetType)}<br><strong>Reason:</strong> ${escapeHtml(reason)}<br><strong>Target id:</strong> ${escapeHtml(targetId)}<br><strong>Reporter id:</strong> ${escapeHtml(reporterId)}</p><p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a><br><a href="${escapeHtml(`${appUrl}/admin`)}">Open admin</a></p>`,
    });
    if (!result.sent) console.error("Report mail not sent:", result.reason);
  } catch (error) {
    console.error("Report mail failed:", error);
  }
}
