/**
 * Order emails and purchase reporting go through TEGO's API, on House of Track's
 * own TEGO client account:
 *
 *  - POST /api/v1/email/send (scope email:send): TEGO picks the From address from
 *    the account's sending identity (houseoftrack.media, once its DKIM is in
 *    Cloudflare). Retries are deduplicated by the Idempotency-Key header, which is
 *    per order + recipient, so a re-delivered webhook never mails twice.
 *  - POST /api/v1/contacts (scope contacts:write): newsletter and "notify me"
 *    signups become email contacts, tagged so a drop's launch email can target them.
 *    Upserts by email and only ADDS tags, so a repeat signup is harmless.
 *  - POST /api/v1/purchases (scope purchases:write): the sale lands on the buyer's
 *    TEGO contact. Idempotent on (source, externalId); externalId is
 *    "house-of-track-shop:<order number>".
 *
 * Off until TEGO_API_KEY is set. Every call is best-effort: a failure is logged
 * and never fails the Stripe webhook (the order is already paid and stored).
 */

const DEFAULT_BASE = "https://www.tegomarketing.com";

function base(): string {
  return process.env.TEGO_API_URL?.trim() || DEFAULT_BASE;
}

export function tegoConfigured(): boolean {
  return Boolean(process.env.TEGO_API_KEY?.trim());
}

async function post(path: string, body: unknown, idempotencyKey?: string): Promise<void> {
  const key = process.env.TEGO_API_KEY?.trim();
  if (!key) return;
  const res = await fetch(new URL(path, base()), {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new Error(`TEGO ${path} ${res.status}: ${json?.error?.code ?? ""} ${json?.error?.message ?? ""}`.trim());
  }
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  idempotencyKey: string;
}): Promise<void> {
  const accountId = process.env.TEGO_ACCOUNT_ID?.trim();
  await post(
    "/api/v1/email/send",
    {
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      // Only needed with an admin key; an account-bound key ignores it.
      ...(accountId ? { accountId } : {}),
    },
    // TEGO caps the key length; ours are short ("hot-HOT-1001-receipt-a@b.c" style).
    input.idempotencyKey.slice(0, 200),
  );
}

export async function upsertContact(input: { email: string; tags: string[]; consentSource: string }): Promise<void> {
  const accountId = process.env.TEGO_ACCOUNT_ID?.trim();
  await post("/api/v1/contacts", {
    email: input.email,
    tags: input.tags,
    // Proof of opt-in for the list: where and when they asked to hear from us.
    customFields: { consentSource: input.consentSource, consentAt: new Date().toISOString() },
    ...(accountId ? { accountId } : {}),
  });
}

export async function recordPurchase(input: {
  externalId: string;
  amountCents: number;
  occurredAt: Date;
  email: string | null;
  summary: string;
}): Promise<void> {
  await post("/api/v1/purchases", {
    // TEGO's `source` is a fixed list (square | shopify | api), so the shop names
    // itself in the id instead: "house-of-track-shop:HOT-1001".
    externalId: `house-of-track-shop:${input.externalId}`,
    amountCents: input.amountCents,
    occurredAt: input.occurredAt.toISOString(),
    currency: "usd",
    status: "paid",
    summary: input.summary,
    ...(input.email ? { email: input.email } : {}),
    source: "api",
  });
}

/** ORDER_ALERT_EMAILS: the fallback list, used only while /admin/settings has none. */
export function envAlertRecipients(): string[] {
  return (process.env.ORDER_ALERT_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}

