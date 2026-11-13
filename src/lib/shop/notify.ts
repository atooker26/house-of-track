import { asc } from "drizzle-orm";
import type { Db } from "@/db";
import { orderAlertRecipients as alertTable } from "@/db/schema";
import { absoluteUrl, EMAIL_COLORS, emailButton, emailLayout, esc } from "@/lib/email/layout";
import { formatCents, formatShipsBy } from "./catalog";
import { getOrderView } from "./orders";
import { STATEMENT_DESCRIPTOR } from "./stripe";
import { envAlertRecipients, recordPurchase, sendEmail, tegoConfigured } from "./tego";


type View = NonNullable<Awaited<ReturnType<typeof getOrderView>>>;

const { muted, rule } = EMAIL_COLORS;

/** One line per item: photo, name and size, and the right-hand column (price or quantity). */
function itemRows(v: View, right: (it: View["items"][number]) => string, withSku = false): string {
  return v.items
    .map((it) => {
      const photo = it.image
        ? `<img src="${esc(absoluteUrl(it.image))}" width="64" height="64" alt="${esc(it.productName)}" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:8px;border:0">`
        : "";
      const sku = withSku ? `<br><span style="font-size:12px;color:${muted}">SKU ${esc(it.sku)}</span>` : "";
      return `<tr>
<td width="76" style="padding:10px 12px 10px 0;vertical-align:middle">${photo}</td>
<td style="padding:10px 0;vertical-align:middle"><strong>${esc(it.productName)}</strong><br><span style="color:${muted}">${esc(it.variantLabel)} · Qty ${it.qty}</span>${sku}</td>
<td style="padding:10px 0;vertical-align:middle;text-align:right;white-space:nowrap">${right(it)}</td>
</tr>`;
    })
    .join("");
}

function table(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 0">${rows}</table>`;
}

function block(label: string, lines: string[]): string {
  return `<p style="margin:20px 0 0"><strong>${esc(label)}</strong><br>${lines.map(esc).join("<br>")}</p>`;
}

function addressLines(v: View): string[] {
  const a = v.order.shipping;
  if (!a) return [];
  return [
    a.name ?? v.order.name ?? "",
    a.line1 ?? "",
    a.line2 ?? "",
    [[a.city, a.state].filter(Boolean).join(", "), a.postalCode].filter(Boolean).join(" "),
    a.country && a.country !== "US" ? a.country : "",
  ].filter((l) => l.trim().length > 0);
}

function totalsRows(v: View): string {
  const o = v.order;
  const line = (label: string, value: string, bold = false) =>
    `<tr><td colspan="2" style="padding:8px 0;border-top:1px solid ${rule}${bold ? ";font-weight:700" : ""}">${label}</td><td style="padding:8px 0;border-top:1px solid ${rule};text-align:right${bold ? ";font-weight:700" : ""}">${value}</td></tr>`;
  return (
    line("Subtotal", formatCents(o.subtotalCents)) +
    line("Shipping", o.shippingCents ? formatCents(o.shippingCents) : "Free") +
    line("Total", formatCents(o.totalCents), true)
  );
}


export function receiptEmail(v: View): { subject: string; html: string; text: string } {
  const o = v.order;
  const first = (o.name ?? "").split(" ")[0];
  const addr = addressLines(v);
  const ships = v.shipsBy ? ` It ships by ${formatShipsBy(v.shipsBy)}.` : "";
  const html = emailLayout({
    title: `Order ${o.number} confirmed`,
    preheader: `Thanks for your order.${ships} Here's your receipt.`,
    body: `<p style="margin:0 0 8px">${first ? `Thanks, ${esc(first)}.` : "Thanks."} Your order is in.${esc(ships)} We'll email you again when it ships.</p>
${table(itemRows(v, (it) => formatCents(it.unitPriceCents * it.qty)) + totalsRows(v))}
${addr.length ? block("Shipping to", addr) : ""}
<p style="margin:24px 0 0;font-size:13px;color:${muted}">Your card statement will read ${esc(STATEMENT_DESCRIPTOR)}. Questions? Just reply to this email.</p>`,
  });
  const text = [
    `Order ${o.number} confirmed.${v.shipsBy ? ` It ships by ${formatShipsBy(v.shipsBy)}.` : ""}`,
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
  const html = emailLayout({
    title: `New order ${o.number}`,
    preheader: `Paid ${formatCents(o.totalCents)}, ${units} unit${units === 1 ? "" : "s"}. Ship this one.`,
    body: `<p style="margin:0 0 8px">Paid <strong>${formatCents(o.totalCents)}</strong>. Ship this one.</p>
${table(itemRows(v, (it) => `× ${it.qty}`, true))}
${block("Ship to", addr.length ? addr : ["No address on the order"])}
${block("Buyer", [o.name ?? "", o.email ?? ""].filter(Boolean))}
<p style="margin:24px 0 0;font-size:13px;color:${muted}">Reply to this email to reach the buyer. Mark it shipped in the shop admin to email them their tracking.</p>`,
  });
  const text = [
    `New order ${o.number}: ${units} unit(s), paid ${formatCents(o.totalCents)}.`,
    ...v.items.map((it) => `${it.productName} — ${it.variantLabel} (SKU ${it.sku}) x ${it.qty}`),
    `Ship to: ${addr.join(", ") || "no address"}`,
    `Buyer: ${o.name ?? ""} ${o.email ?? ""}`.trim(),
  ].join("\n");
  return { subject: `New House of Track order ${o.number} (${units} unit${units === 1 ? "" : "s"})`, html, text };
}

/** Who gets "New order": the list in /admin/settings, or ORDER_ALERT_EMAILS while that's empty. */
export async function orderAlertRecipients(db: Db): Promise<string[]> {
  const rows = await db.select({ email: alertTable.email }).from(alertTable).orderBy(asc(alertTable.createdAt));
  return rows.length ? rows.map((r) => r.email) : envAlertRecipients();
}

/**
 * After a paid order: receipt to the buyer, an alert to the order-alert list (/admin/settings)
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
  for (const to of await orderAlertRecipients(db)) {
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
    ? `<p style="margin:20px 0 0"><strong>Tracking</strong><br>${esc(o.trackingCarrier ?? "")} ${esc(o.trackingNumber)}</p>${url ? emailButton("Track your package", url) : ""}`
    : "";
  const html = emailLayout({
    title: `Order ${o.number} shipped`,
    preheader: `Your House of Track order is on its way.`,
    body: `<p style="margin:0 0 8px">${first ? `Good news, ${esc(first)}.` : "Good news."} Your order is on its way.</p>
${table(itemRows(v, (it) => `× ${it.qty}`))}
${tracking}
${addr.length ? block("Shipping to", addr) : ""}
<p style="margin:24px 0 0;font-size:13px;color:${muted}">Questions? Just reply to this email.</p>`,
  });
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
