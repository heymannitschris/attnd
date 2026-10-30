import { escapeHtml } from "@/lib/email";
import { SUPPORT_EMAIL } from "@/lib/support";
import { eventTimeZone } from "@/lib/event-time";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.attnd.space").replace(/\/$/, "");
const LOGO_URL = `${SITE_URL}/brand/attnd-wordmark-white.png`;

export type EmailDetail = { label: string; value: string; href?: string };
export type EmailContent = {
  /** Hidden inbox preview line. */
  preheader: string;
  eyebrow?: string;
  heading: string;
  /** Paragraphs of plain text (escaped). */
  paragraphs?: string[];
  /** Absolute https cover image. */
  coverUrl?: string | null;
  coverAlt?: string;
  details?: EmailDetail[];
  cta?: { label: string; href: string };
  secondaryLink?: { label: string; href: string };
  /** cid: or https: QR image plus caption. */
  qr?: { src: string; caption: string };
  /** Short note above the footer, e.g. why the recipient got the mail. */
  footnote?: string;
  /** Show the "manage notifications" hint (default true). */
  showPreferences?: boolean;
};
export type RenderedEmail = { subject: string; html: string; text: string };

/** Make a stored path/URL absolute on the public site so mail clients can load it. */
export function absoluteUrl(value?: string | null) {
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return value;
  if (/^http:\/\//i.test(value)) return null;
  return `${SITE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}

export function formatEventWhen(startsAt: string, endsAt?: string | null, timezone?: string | null) {
  const timeZone = eventTimeZone(timezone);
  const start = new Date(startsAt);
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone }).format(start);
  const time = (value: Date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(value);
  const zone = new Intl.DateTimeFormat("en-GB", { timeZoneName: "short", timeZone }).formatToParts(start).find((part) => part.type === "timeZoneName")?.value || timeZone;
  const range = endsAt ? `${time(start)}–${time(new Date(endsAt))}` : time(start);
  return { date, time: `${range} (${zone})`, full: `${date}, ${range} (${zone})` };
}

export function mapsUrl(place: { venue_name?: string | null; address?: string | null; city?: string | null; latitude?: number | null; longitude?: number | null }) {
  if (typeof place.latitude === "number" && typeof place.longitude === "number") return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  const query = [place.venue_name, place.address, place.city].filter(Boolean).join(", ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : undefined;
}

const e = escapeHtml;
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function renderEmail(subject: string, c: EmailContent): RenderedEmail {
  const showPrefs = c.showPreferences !== false;
  const paragraphs = (c.paragraphs || []).map((p) => `<p class="ink2" style="margin:0 0 14px;font:400 16px/1.55 ${FONT};color:#3d3a35;">${e(p)}</p>`).join("");
  const details = c.details?.length ? `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="panel" style="margin:6px 0 22px;background:#f6f3ec;border-radius:14px;">
${c.details.map((d, i) => `<tr><td style="padding:${i === 0 ? 16 : 10}px 18px ${i === c.details!.length - 1 ? 16 : 0}px;">
<div class="ink3" style="font:600 11px/1.3 ${FONT};letter-spacing:.08em;text-transform:uppercase;color:#8a857b;">${e(d.label)}</div>
<div style="font:500 15px/1.45 ${FONT};color:#0a0a0a;" class="ink">${d.href ? `<a href="${e(d.href)}" class="ink" style="color:#0a0a0a;text-decoration:underline;">${e(d.value)}</a>` : e(d.value)}</div>
</td></tr>`).join("")}
</table>` : "";
  const cta = c.cta ? `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 18px;"><tr><td align="center">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${e(c.cta.href)}" style="height:52px;v-text-anchor:middle;width:320px;" arcsize="50%" fillcolor="#0a0a0a" stroke="f"><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${e(c.cta.label)}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${e(c.cta.href)}" class="btn" style="display:block;max-width:360px;background:#0a0a0a;color:#ffffff;border-radius:999px;padding:16px 24px;font:700 16px/20px ${FONT};text-align:center;text-decoration:none;">${e(c.cta.label)}</a><!--<![endif]-->
</td></tr></table>` : "";
  const secondary = c.secondaryLink ? `<p style="margin:0 0 8px;text-align:center;font:500 14px/1.4 ${FONT};"><a href="${e(c.secondaryLink.href)}" class="ink2" style="color:#3d3a35;text-decoration:underline;">${e(c.secondaryLink.label)}</a></p>` : "";
  const qr = c.qr ? `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 22px;"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e6e1d6;border-radius:16px;"><tr><td style="padding:16px;">
<img src="${e(c.qr.src)}" width="200" height="200" alt="Ticket QR code" style="display:block;width:200px;height:200px;border:0;">
</td></tr></table>
<div class="ink3" style="margin-top:10px;font:400 13px/1.4 ${FONT};color:#8a857b;">${e(c.qr.caption)}</div>
</td></tr></table>` : "";
  const cover = c.coverUrl ? `<tr><td style="padding:0;"><img src="${e(c.coverUrl)}" width="600" alt="${e(c.coverAlt || "")}" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>` : "";
  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${e(subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark;}
body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
a{color:inherit;}
@media (max-width:620px){.container{width:100%!important;}.pad{padding-left:22px!important;padding-right:22px!important;}h1.h{font-size:26px!important;}}
@media (prefers-color-scheme:dark){
.bg{background:#000000!important;}.card{background:#0c0c0c!important;}.panel{background:#161616!important;}
.ink{color:#f7f7f7!important;}.ink2{color:#c8c8c8!important;}.ink3{color:#8f8f8f!important;}
.btn{background:#ffffff!important;color:#000000!important;}.rule{border-color:#262626!important;}
}
[data-ogsc] .card{background:#0c0c0c!important;}[data-ogsc] .ink{color:#f7f7f7!important;}[data-ogsc] .ink2{color:#c8c8c8!important;}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:#f1efea;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f1efea;opacity:0;">${e(c.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background:#f1efea;"><tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="container card" style="width:600px;max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;">
<tr><td style="background:#000000;padding:20px 32px;" class="pad"><a href="${SITE_URL}" style="text-decoration:none;"><img src="${LOGO_URL}" width="96" height="32" alt="attnd" style="display:block;width:96px;height:auto;border:0;color:#ffffff;font:700 22px ${FONT};"></a></td></tr>
${cover}
<tr><td class="pad" style="padding:30px 32px 10px;">
${c.eyebrow ? `<div class="ink3" style="margin:0 0 8px;font:700 12px/1.3 ${FONT};letter-spacing:.1em;text-transform:uppercase;color:#8a857b;">${e(c.eyebrow)}</div>` : ""}
<h1 class="h ink" style="margin:0 0 16px;font:700 30px/1.15 ${FONT};letter-spacing:-.01em;color:#0a0a0a;">${e(c.heading)}</h1>
${paragraphs}${details}${qr}${cta}${secondary}
</td></tr>
<tr><td class="pad" style="padding:18px 32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="rule" style="border-top:1px solid #ece8df;padding-top:18px;font:400 12px/1.6 ${FONT};color:#8a857b;" >
${c.footnote ? `<p class="ink3" style="margin:0 0 8px;">${e(c.footnote)}</p>` : ""}
<p class="ink3" style="margin:0 0 8px;">Questions? Write to <a href="mailto:${SUPPORT_EMAIL}" class="ink2" style="color:#3d3a35;">${SUPPORT_EMAIL}</a>${showPrefs ? ` · <a href="${SITE_URL}/profile/settings" class="ink2" style="color:#3d3a35;">Manage email notifications</a>` : ""}</p>
<p class="ink3" style="margin:0;">attnd · Events on Koh Phangan &amp; beyond · <a href="${SITE_URL}" class="ink2" style="color:#3d3a35;">attnd.space</a></p>
</td></tr></table>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
  const text = [
    c.eyebrow?.toUpperCase(),
    c.heading,
    "",
    ...(c.paragraphs || []).flatMap((p) => [p, ""]),
    ...(c.details || []).map((d) => `${d.label}: ${d.value}${d.href ? ` (${d.href})` : ""}`),
    c.details?.length ? "" : undefined,
    c.qr ? `${c.qr.caption}` : undefined,
    c.cta ? `${c.cta.label}: ${c.cta.href}` : undefined,
    c.secondaryLink ? `${c.secondaryLink.label}: ${c.secondaryLink.href}` : undefined,
    "",
    "—",
    c.footnote,
    `Questions? ${SUPPORT_EMAIL}`,
    showPrefs ? `Manage email notifications: ${SITE_URL}/profile/settings` : undefined,
    `attnd · ${SITE_URL}`,
  ].filter((line) => line !== undefined).join("\n");
  return { subject, html, text };
}
