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
  await call("POST", path, body, idempotencyKey);
}

/** One TEGO API call; returns the parsed JSON (or null without a key). */
async function call<T = unknown>(method: "GET" | "POST", path: string, body?: unknown, idempotencyKey?: string): Promise<T | null> {
  const key = process.env.TEGO_API_KEY?.trim();
  if (!key) return null;
  const res = await fetch(new URL(path, base()), {
    method,
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: { code?: string; message?: string } }) | null;
  if (!res.ok) {
    throw new Error(`TEGO ${path} ${res.status}: ${json?.error?.code ?? ""} ${json?.error?.message ?? ""}`.trim());
  }
  return json;
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

export async function upsertContact(
  input:
    // Opt-in signups: proof of consent is stamped here.
    | { email: string; tags: string[]; consentSource: string; firstName?: string; lastName?: string }
    // Anything else (survey responses): the caller supplies its own fields,
    // and consent only if the person actually gave it.
    | { email: string; tags: string[]; firstName?: string; lastName?: string; customFields: Record<string, string> },
): Promise<void> {
  const accountId = process.env.TEGO_ACCOUNT_ID?.trim();
  const fields =
    "consentSource" in input
      ? // Proof of opt-in for the list: where and when they asked to hear from us.
        { customFields: { consentSource: input.consentSource, consentAt: new Date().toISOString() } }
      : { customFields: input.customFields };
  const names = {
    ...(input.firstName ? { firstName: input.firstName } : {}),
    ...(input.lastName ? { lastName: input.lastName } : {}),
  };
  await post("/api/v1/contacts", {
    email: input.email,
    tags: input.tags,
    ...fields,
    ...names,
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


/**
 * The CRM side of a coach survey response (scopes crm:read + crm:write): the
 * school as an organization, the coach as a CRM contact at that school, and one
 * deal on the "Coach uniforms" pipeline so the Davids can work it as a lead.
 *
 * Idempotent: the organization is keyed on school + state and the deal on the
 * coach's email, so a coach who answers twice updates their deal (new notes,
 * new expected close) without moving it back to the first stage.
 *
 * The pipeline is found by name, so renaming it in TEGO turns this off (logged)
 * rather than writing to the wrong board.
 */
export const COACH_PIPELINE_NAME = "Coach uniforms";

export async function recordSurveyLead(input: {
  email: string;
  name: string;
  school: string;
  state: string;
  coachRole: string;
  tags: string[];
  expectedCloseAt: Date | null;
  notes: string;
}): Promise<void> {
  if (!tegoConfigured()) return;

  type Pipeline = { id: string; name: string };
  const pipelines = await call<{ data: Pipeline[] }>("GET", "/api/v1/crm/pipelines");
  const pipeline = pipelines?.data.find((p) => p.name.trim().toLowerCase() === COACH_PIPELINE_NAME.toLowerCase());
  if (!pipeline) throw new Error(`TEGO pipeline "${COACH_PIPELINE_NAME}" not found`);

  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const org = await call<{ data: { id: string } }>("POST", "/api/v1/crm/organizations", {
    externalId: `hs:${slug(input.school)}:${slug(input.state)}`.slice(0, 200),
    name: input.school,
    region: input.state,
    tags: ["high-school"],
  });

  const contact = await call<{ data: { id: string } }>("POST", "/api/v1/crm/contacts", {
    email: input.email,
    name: input.name,
    company: input.school,
    ...(input.coachRole ? { title: input.coachRole } : {}),
    tags: input.tags,
  });

  await call("POST", "/api/v1/crm/deals", {
    externalId: `coach-survey:${input.email}`.slice(0, 200),
    pipelineId: pipeline.id,
    name: `${input.school} uniforms`.slice(0, 200),
    contactId: contact?.data.id ?? null,
    organizationId: org?.data.id ?? null,
    expectedCloseAt: input.expectedCloseAt?.toISOString() ?? null,
    notes: input.notes.slice(0, 5000),
  });
}
