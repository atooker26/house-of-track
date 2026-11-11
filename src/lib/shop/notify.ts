import type { Db } from "@/db";
import { formatCents } from "./catalog";
import { getOrderView } from "./orders";
import { STATEMENT_DESCRIPTOR } from "./stripe";
import { orderAlertRecipients, recordPurchase, sendEmail, tegoConfigured } from "./tego";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type View = NonNullable<Awaited<ReturnType<typeof getOrderView>>>;

function itemsHtml(v: View): string {
  return v.items
    .map(
      (it) =>
        `<tr><td style="padding:6px 0">${esc(it.productName)} — ${esc(it.variantLabel)} × ${it.qty}</td>` +
        `<td style="padding:6px 0;text-align:right">${formatCents(it.unitPriceCents * it.qty)}</td></tr>`,
    )
    .join("");
}

function addressLines(v: View): string[] {
  const a = v.order.shipping;
  if (!a) return [];
  return [
    a.name ?? v.order.name ?? "",
    a.line1 ?? "",
    a.line2 ?? "",
    [a.city, a.state, a.postalCode].filter(Boolean).join(", "),
    a.country && a.country !== "US" ? a.country : "",
  ].filter((l) => l.trim().length > 0);
}

function totalsHtml(v: View): string {
  const o = v.order;
  return `
    <tr><td style="padding:6px 0;border-top:1px solid #ddd">Shipping</td><td style="padding:6px 0;border-top:1px solid #ddd;text-align:right">${o.shippingCents ? formatCents(o.shippingCents) : "Free"}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700">Total</td><td style="padding:6px 0;text-align:right;font-weight:700">${formatCents(o.totalCents)}</td></tr>`;
}

function shell(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#EDE9D8;font-family:Helvetica,Arial,sans-serif;color:#2B2928">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 8px">House of Track</p>
<h1 style="font-size:26px;text-transform:uppercase;margin:0 0 18px">${esc(title)}</h1>
${body}
</div></body></html>`;
}

export function receiptEmail(v: View): { subject: string; html: string; text: string } {
  const o = v.order;
  const first = (o.name ?? "").split(" ")[0];
  const addr = addressLines(v);
  const html = shell(
    `Order ${o.number} confirmed`,
    `<p>${first ? `Thanks, ${esc(first)}.` : "Thanks."} Your order is in. We'll email you again when it ships.</p>
<table style="width:100%;border-collapse:collapse;font-size:15px">${itemsHtml(v)}${totalsHtml(v)}</table>
${addr.length ? `<p style="margin-top:20px"><strong>Shipping to</strong><br>${addr.map(esc).join("<br>")}</p>` : ""}
<p style="font-size:13px;color:#555;margin-top:20px">Your card statement will read ${esc(STATEMENT_DESCRIPTOR)}. Questions? Reply to this email.</p>`,
  );
  const text = [
    `Order ${o.number} confirmed.`,
    ...v.items.map((it) => `${it.productName} — ${it.variantLabel} x ${it.qty}: ${formatCents(it.unitPriceCents * it.qty)}`),
    `Shipping: ${o.shippingCents ? formatCents(o.shippingCents) : "Free"}`,
    `Total: ${formatCents(o.totalCents)}`,
    addr.length ? `Shipping to: ${addr.join(", ")}` : "",
    `Your card statement will read ${STATEMENT_DESCRIPTOR}.`,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject: `Your House of Track order ${o.number}`, html, text };
}

export function alertEmail(v: View): { subject: string; html: string; text: string } {
  const o = v.order;
  const addr = addressLines(v);
  const units = v.items.reduce((n, it) => n + it.qty, 0);
  const html = shell(
    `New order ${o.number}`,
    `<p>Paid ${formatCents(o.totalCents)}. Ship this one.</p>
<table style="width:100%;border-collapse:collapse;font-size:15px">${v.items
      .map(
        (it) =>
          `<tr><td style="padding:6px 0">${esc(it.productName)} — ${esc(it.variantLabel)}<br><span style="font-size:12px;color:#555">SKU ${esc(it.sku)}</span></td><td style="padding:6px 0;text-align:right">× ${it.qty}</td></tr>`,
      )
      .join("")}</table>
<p style="margin-top:20px"><strong>Ship to</strong><br>${addr.length ? addr.map(esc).join("<br>") : "No address on the order"}</p>
<p><strong>Buyer</strong><br>${esc(o.name ?? "")}${o.email ? `<br>${esc(o.email)}` : ""}</p>`,
  );
  const text = [
    `New order ${o.number}: ${units} unit(s), paid ${formatCents(o.totalCents)}.`,
    ...v.items.map((it) => `${it.productName} — ${it.variantLabel} (SKU ${it.sku}) x ${it.qty}`),
    `Ship to: ${addr.join(", ") || "no address"}`,
    `Buyer: ${o.name ?? ""} ${o.email ?? ""}`.trim(),
  ].join("\n");
  return { subject: `New House of Track order ${o.number} (${units} unit${units === 1 ? "" : "s"})`, html, text };
}

/**
 * After a paid order: receipt to the buyer, an alert to ORDER_ALERT_EMAILS
 * (Kirk at Pyramid ships it; House of Track sees it), and the sale on TEGO.
 * Each step is independent and only logs on failure.
 */
export async function notifyPaidOrder(db: Db, orderId: number): Promise<void> {
  if (!tegoConfigured()) {
    console.info(`[shop] order ${orderId} paid; TEGO_API_KEY unset, no emails sent`);
    return;
  }
  const v = await getOrderView(db, { orderId });
  if (!v || v.order.status !== "paid") return;
  const o = v.order;
  const steps: Array<[string, () => Promise<void>]> = [];

  if (o.email) {
    const r = receiptEmail(v);
    steps.push(["receipt", () => sendEmail({ to: o.email!, ...r, idempotencyKey: `hot-${o.number}-receipt` })]);
  }
  for (const to of orderAlertRecipients()) {
    const a = alertEmail(v);
    steps.push([
      `alert:${to}`,
      () => sendEmail({ to, ...a, ...(o.email ? { replyTo: o.email } : {}), idempotencyKey: `hot-${o.number}-alert-${to}` }),
    ]);
  }
  steps.push([
    "purchase",
    () =>
      recordPurchase({
        externalId: o.number,
        amountCents: o.totalCents,
        occurredAt: o.paidAt ?? new Date(),
        email: o.email,
        summary: v.items.map((it) => `${it.productName} (${it.variantLabel}) × ${it.qty}`).join(", "),
      }),
  ]);

  for (const [name, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[shop] ${o.number} ${name} failed:`, err instanceof Error ? err.message : err);
    }
  }
}

export const CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "Other"] as const;

/** A tracking link for the carriers Pyramid ships with; null for anything else. */
export function trackingUrl(carrier: string | null, number: string | null): string | null {
  if (!number) return null;
  const n = encodeURIComponent(number.trim());
  switch ((carrier ?? "").toLowerCase()) {
    case "usps":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
    case "ups":
      return `https://www.ups.com/track?tracknum=${n}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    case "dhl":
      return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?tracking-id=${n}`;
    default:
      return null;
  }
}

export function shippedEmail(v: View): { subject: string; html: string; text: string } {
  const o = v.order;
  const first = (o.name ?? "").split(" ")[0];
  const addr = addressLines(v);
  const url = trackingUrl(o.trackingCarrier, o.trackingNumber);
  const tracking = o.trackingNumber
    ? `<p style="margin-top:20px"><strong>Tracking</strong><br>${esc(o.trackingCarrier ?? "")} ${
        url ? `<a href="${esc(url)}" style="color:#4540BF">${esc(o.trackingNumber)}</a>` : esc(o.trackingNumber)
      }</p>`
    : "";
  const html = shell(
    `Order ${o.number} shipped`,
    `<p>${first ? `Good news, ${esc(first)}.` : "Good news."} Your order is on its way.</p>
<table style="width:100%;border-collapse:collapse;font-size:15px">${v.items
      .map(
        (it) =>
          `<tr><td style="padding:6px 0">${esc(it.productName)} — ${esc(it.variantLabel)}</td><td style="padding:6px 0;text-align:right">× ${it.qty}</td></tr>`,
      )
      .join("")}</table>
${tracking}
${addr.length ? `<p style="margin-top:20px"><strong>Shipping to</strong><br>${addr.map(esc).join("<br>")}</p>` : ""}
<p style="font-size:13px;color:#555;margin-top:20px">Questions? Reply to this email.</p>`,
  );
  const text = [
    `Order ${o.number} shipped.`,
    ...v.items.map((it) => `${it.productName} — ${it.variantLabel} x ${it.qty}`),
    o.trackingNumber ? `Tracking: ${o.trackingCarrier ?? ""} ${o.trackingNumber}${url ? ` (${url})` : ""}`.trim() : "",
    addr.length ? `Shipping to: ${addr.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { subject: `Your House of Track order ${o.number} shipped`, html, text };
}

/**
 * The buyer's "shipped" email. Throws on failure (the admin sees it and can
 * resend); the idempotency key includes the tracking number, so marking shipped
 * twice with the same number never mails twice, but a corrected number does.
 */
export async function sendShippedEmail(db: Db, orderId: number): Promise<"sent" | "no-email" | "no-tego"> {
  if (!tegoConfigured()) return "no-tego";
  const v = await getOrderView(db, { orderId });
  if (!v?.order.email) return "no-email";
  const e = shippedEmail(v);
  await sendEmail({
    to: v.order.email,
    ...e,
    idempotencyKey: `hot-${v.order.number}-shipped-${v.order.trackingNumber ?? "none"}`,
  });
  return "sent";
}
