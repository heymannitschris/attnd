export type EmailAttachment = { filename: string; content: string; content_type?: string; content_id?: string };
type EmailInput = { to: string; subject: string; html: string; text?: string; attachments?: EmailAttachment[]; idempotencyKey?: string };

export async function sendEmail({ idempotencyKey, ...input }: EmailInput) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { sent: false as const, reason: "Email delivery is not configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      // Resend drops a second request with the same key within 24h, so retries/overlapping crons cannot double-send.
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey.slice(0, 256) } : {}),
    },
    body: JSON.stringify({ from, ...input }),
  });
  const result = await response.json() as { id?: string; message?: string };
  if (!response.ok) return { sent: false as const, reason: result.message || "Email delivery failed" };
  return { sent: true as const, id: result.id };
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}
