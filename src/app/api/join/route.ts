import { NextRequest, NextResponse } from "next/server";
import { upsertContact } from "@/lib/shop/tego";

const TEGO_WEBHOOK_URL = "https://www.tegomarketing.com/api/webhooks/house-of-track";
const TEGO_WEBHOOK_SECRET = process.env.TEGO_WEBHOOK_SECRET ?? "";

const ALLOWED_FORM_TYPES = new Set([
  "creative-signup",
  "athlete-signup",
  "newsletter",
  // Someone asking to be taken off a creator profile. Routed here rather than to a
  // mailto so it lands in the same inbox as everything else and can't be missed.
  "profile-removal",
  // "Email me when it drops" on a product that isn't buyable yet (or sold out).
  "drop-notify",
]);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The forms whose whole point is "email me", so the address becomes a TEGO email
 * contact. The join forms (creative/athlete) don't: signing up for the roster isn't
 * asking for marketing email.
 */
function contactFor(formType: string, dropSlug: string | null): { tags: string[]; consentSource: string } | null {
  if (formType === "newsletter") return { tags: ["newsletter"], consentSource: "houseoftrack.media newsletter signup" };
  if (formType === "drop-notify" && dropSlug) {
    return { tags: ["shop-notify", `drop:${dropSlug}`], consentSource: `houseoftrack.media notify me: ${dropSlug}` };
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!TEGO_WEBHOOK_SECRET) {
    console.error("TEGO_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot check
  if (body._hp && String(body._hp).length > 0) {
    return NextResponse.json({ ok: true });
  }

  const formType = String(body.formType ?? "");
  if (!ALLOWED_FORM_TYPES.has(formType)) {
    return NextResponse.json({ error: "Invalid form type" }, { status: 400 });
  }

  const dropSlug = typeof body.dropSlug === "string" && SLUG.test(body.dropSlug) ? body.dropSlug : null;
  if (formType === "drop-notify" && !dropSlug) {
    return NextResponse.json({ error: "Missing drop" }, { status: 400 });
  }

  const res = await fetch(TEGO_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": TEGO_WEBHOOK_SECRET,
    },
    body: JSON.stringify({
      formType,
      role: body.role,
      name: body.name,
      email: body.email,
      // creative fields
      craft: body.craft,
      location: body.location,
      portfolio: body.portfolio,
      // athlete fields
      eventGroup: body.eventGroup,
      meets: body.meets,
      photoConsent: body.photoConsent,
      // profile-removal fields — which profile, and anything they wanted to say
      profileSlug: body.profileSlug,
      profileName: body.profileName,
      message: body.message,
      dropSlug,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    console.error("TEGO webhook failed:", res.status);
    return NextResponse.json({ error: "Submission failed" }, { status: 502 });
  }

  // Best-effort: the signup is already in TEGO's inbox above, so a failure here is
  // logged rather than shown to the person signing up.
  const contact = contactFor(formType, dropSlug);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (contact && EMAIL.test(email)) {
    await upsertContact({ email, ...contact }).catch((err) => console.error("[join] TEGO contact failed:", err));
  }

  return NextResponse.json({ ok: true });
}
