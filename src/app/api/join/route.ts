import { NextRequest, NextResponse } from "next/server";

const TEGO_WEBHOOK_URL = "https://www.tegomarketing.com/api/webhooks/house-of-track";
const TEGO_WEBHOOK_SECRET = process.env.TEGO_WEBHOOK_SECRET ?? "";

const ALLOWED_FORM_TYPES = new Set(["creative-signup", "athlete-signup", "newsletter"]);

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
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    console.error("TEGO webhook failed:", res.status);
    return NextResponse.json({ error: "Submission failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
