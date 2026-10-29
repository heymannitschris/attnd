type EmailInput = { to: string; subject: string; html: string };

export async function sendEmail(input: EmailInput) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { sent: false as const, reason: "Email delivery is not configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, ...input }),
  });
  const result = await response.json() as { id?: string; message?: string };
  if (!response.ok) return { sent: false as const, reason: result.message || "Email delivery failed" };
  return { sent: true as const, id: result.id };
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}
