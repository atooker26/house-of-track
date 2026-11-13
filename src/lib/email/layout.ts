/**
 * The one layout every House of Track email uses (receipt, order alert, shipped,
 * admin invite and reset). Table-based and inline-styled, because email clients
 * (Outlook above all) ignore most CSS; images use absolute URLs because an email has
 * no page to resolve a relative one against.
 */

const SITE = "https://www.houseoftrack.media";

export const EMAIL_COLORS = {
  cream: "#EDE9D8",
  card: "#FFFFFF",
  ink: "#2B2928",
  muted: "#5A5856",
  rule: "#E2DDC9",
  indigo: "#4540BF",
} as const;

const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Product photos are stored as either full URLs (Storage) or site paths (/assets/…). */
export function absoluteUrl(src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  return `${SITE}${src.startsWith("/") ? "" : "/"}${src}`;
}

/** A pill button that survives Outlook (a padded table cell, not a styled link alone). */
export function emailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0"><tr>
<td style="background:${EMAIL_COLORS.indigo};border-radius:999px">
<a href="${esc(url)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px">${esc(label)}</a>
</td></tr></table>`;
}

export function emailLayout(input: {
  /** Big uppercase heading on the card. */
  title: string;
  /** The grey line inboxes show next to the subject. Plain text. */
  preheader: string;
  /** Inner HTML of the card, already escaped. */
  body: string;
}): string {
  const { cream, card, ink, muted } = EMAIL_COLORS;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(input.title)}</title></head>
<body style="margin:0;padding:0;background:${cream}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${cream}">${esc(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${cream}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td align="center" style="padding:0 0 24px">
<a href="${SITE}" style="text-decoration:none"><img src="${SITE}/assets/wordmark-navy.png" width="180" alt="House of Track" style="display:block;width:180px;height:auto;border:0"></a>
</td></tr>
<tr><td style="background:${card};border-radius:12px;padding:32px 28px;font-family:${FONT};font-size:15px;line-height:1.55;color:${ink}">
<h1 style="margin:0 0 16px;font-family:${FONT};font-size:24px;line-height:1.15;font-weight:800;letter-spacing:.01em;text-transform:uppercase;color:${ink}">${esc(input.title)}</h1>
${input.body}
</td></tr>
<tr><td align="center" style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${muted}">
House of Track · Share. Connect. Inspire.<br><a href="${SITE}" style="color:${muted}">houseoftrack.media</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
