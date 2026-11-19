import { NextRequest, NextResponse } from "next/server";
import { recordSurveyLead, upsertContact } from "@/lib/shop/tego";
import { COACH_ROLES, OPT_IN_LABEL, OTHER, PROGRAMS, SURVEY_QUESTIONS, SURVEY_SLUG, answerSlug, expectedCloseFor } from "@/lib/survey";

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
  // The coach uniform survey at /survey. Every response becomes a TEGO contact
  // (that's the point: coaches as leads), marketing opt-in only if they ticked it.
  "coach-survey",
  // Homepage "Join the Network": any of creative / athlete / fan, each a TEGO list (tag).
  "network-join",
]);

const NETWORK_ROLE_IDS = new Set(["creative", "athlete", "fan"]);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The forms whose whole point is "email me", so the address becomes a TEGO email
 * contact. The join forms (creative/athlete) don't: signing up for the roster isn't
 * asking for marketing email.
 */
function contactFor(
  formType: string,
  dropSlug: string | null,
  roles: string[],
): { tags: string[]; consentSource: string } | null {
  if (formType === "network-join" && roles.length > 0) {
    return { tags: ["network", ...roles], consentSource: `houseoftrack.media join the network: ${roles.join(", ")}` };
  }
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

  const roles = Array.isArray(body.roles)
    ? [...new Set(body.roles.filter((r): r is string => typeof r === "string" && NETWORK_ROLE_IDS.has(r)))]
    : [];
  if (formType === "network-join" && roles.length === 0) {
    return NextResponse.json({ error: "Pick at least one" }, { status: 400 });
  }

  const survey = formType === "coach-survey" ? readSurvey(body) : null;
  if (formType === "coach-survey" && !survey) {
    return NextResponse.json({ error: "Incomplete survey" }, { status: 400 });
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
      ...(formType === "network-join" ? { roles: roles.join(", ") } : {}),
      // coach survey: the answers and who gave them, flat so the Space submission reads cleanly
      ...(survey ? { survey: SURVEY_SLUG, ...survey.fields } : {}),
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    console.error("TEGO webhook failed:", res.status);
    return NextResponse.json({ error: "Submission failed" }, { status: 502 });
  }

  // Best-effort: the signup is already in TEGO's inbox above, so a failure here is
  // logged rather than shown to the person signing up.
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (survey) {
    // Email contact first (answers as fields, opt-in), then the CRM lead on the
    // "Coach uniforms" pipeline. Best-effort: the response is already in TEGO's
    // Space submissions above, so a failure is logged, not shown to the coach.
    await upsertContact(survey.contact).catch((err) => console.error("[join] TEGO survey contact failed:", err));
    await recordSurveyLead(survey.lead).catch((err) => console.error("[join] TEGO survey lead failed:", err));
    return NextResponse.json({ ok: true });
  }

  const contact = contactFor(formType, dropSlug, roles);
  if (contact && EMAIL.test(email)) {
    const [firstName, ...rest] = (typeof body.name === "string" ? body.name.trim().slice(0, 120) : "").split(/\s+/);
    await upsertContact({ email, ...contact, firstName: firstName || undefined, lastName: rest.join(" ") || undefined }).catch((err) => console.error("[join] TEGO contact failed:", err));
  }

  return NextResponse.json({ ok: true });
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Validate a coach survey response. Answers must be one of the form's own options
 * (so results group cleanly); name, email, school and state are required.
 * Returns null when anything required is missing or off-list.
 */
function readSurvey(body: Record<string, unknown>) {
  // Single-choice answers as one string; pick-any answers as a de-duplicated list.
  const answers: Record<string, string> = {};
  const picks: Record<string, string[]> = {};
  for (const q of SURVEY_QUESTIONS) {
    const allowed: readonly string[] = q.other ? [...q.options, OTHER] : q.options;
    if (q.multi) {
      const raw = Array.isArray(body[q.key]) ? (body[q.key] as unknown[]) : [];
      const list = [...new Set(raw.map((v) => str(v, 100)))];
      if (list.length === 0 || list.some((a) => !allowed.includes(a))) return null;
      // Keep the form's own order so "A; B" and "B; A" read the same.
      picks[q.key] = allowed.filter((o) => list.includes(o));
      answers[q.key] = picks[q.key].join("; ");
    } else {
      const a = str(body[q.key], 100);
      if (!allowed.includes(a)) return null;
      answers[q.key] = a;
    }
  }
  const limitingFactorOther = picks.limitingFactor?.includes(OTHER) ? str(body.limitingFactorOther, 300) : "";

  const name = str(body.name, 120);
  const email = str(body.email, 200).toLowerCase();
  const school = str(body.school, 160);
  const state = str(body.state, 30);
  if (!name || !EMAIL.test(email) || !school || !state) return null;

  const coachRole = (COACH_ROLES as readonly string[]).includes(str(body.coachRole, 40)) ? str(body.coachRole, 40) : "";
  const program = (PROGRAMS as readonly string[]).includes(str(body.program, 40)) ? str(body.program, 40) : "";
  const optIn = body.optIn === true;

  const [firstName, ...rest] = name.split(/\s+/);
  const submittedAt = new Date().toISOString();

  // Custom-field keys are prefixed so a later survey can't collide with this one.
  const answerFields = {
    uniformLastPurchase: answers.lastPurchase,
    uniformLimitingFactor: answers.limitingFactor,
    ...(limitingFactorOther ? { uniformLimitingFactorOther: limitingFactorOther } : {}),
    uniformNextOrder: answers.nextOrder,
  };
  const about = {
    school,
    state,
    ...(coachRole ? { coachRole } : {}),
    ...(program ? { program } : {}),
  };

  const notes = [
    `Coach uniform survey, ${submittedAt.slice(0, 10)}`,
    `Last bought uniforms: ${answers.lastPurchase}`,
    `Holding them back: ${answers.limitingFactor}${limitingFactorOther ? ` (${limitingFactorOther})` : ""}`,
    `Next order: ${answers.nextOrder}`,
    [coachRole, program].filter(Boolean).join(", "),
    optIn ? "Open to being contacted about team kit offers." : "Did not opt in to future contact.",
  ]
    .filter(Boolean)
    .join("\n");

  // One tag per limiting factor (limit:budget-cost …), so TEGO can count each reason.
  const tags = [
    "coach",
    "coach-survey",
    `survey:${SURVEY_SLUG}`,
    ...(picks.limitingFactor ?? []).map((a) => `limit:${answerSlug(a)}`),
  ];

  return {
    fields: { name, email, ...about, ...answerFields, optIn },
    lead: { email, name, school, state, coachRole, tags, expectedCloseAt: expectedCloseFor(answers.nextOrder), notes },
    contact: {
      email,
      firstName,
      lastName: rest.join(" ") || undefined,
      // Opt-in is specific to team kit offers (David R, 11/18), not the newsletter.
      tags: [...tags, ...(optIn ? ["team-kit-offers"] : [])],
      customFields: {
        ...about,
        ...answerFields,
        surveySubmittedAt: submittedAt,
        // Proof of opt-in, same shape as the newsletter form — only when they ticked it.
        ...(optIn ? { consentSource: `houseoftrack.media coach survey: ${OPT_IN_LABEL}`, consentAt: submittedAt } : {}),
      },
    },
  };
}
