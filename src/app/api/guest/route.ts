import { NextRequest, NextResponse } from "next/server";

const TEGO_WEBHOOK_URL = "https://www.tegomarketing.com/api/webhooks/house-of-track";
const TEGO_WEBHOOK_SECRET = process.env.TEGO_WEBHOOK_SECRET ?? "";

export async function POST(req: NextRequest) {
  if (!TEGO_WEBHOOK_SECRET) {
    console.error("TEGO_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
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

  const res = await fetch(TEGO_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": TEGO_WEBHOOK_SECRET,
    },
    body: JSON.stringify({
      formType: "guest-application",
      name: body.name,
      email: body.email,
      discipline: body.discipline,
      story: body.story,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    console.error("TEGO webhook failed:", res.status);
    return NextResponse.json(
      { error: "Submission failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
