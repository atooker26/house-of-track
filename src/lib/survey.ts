/**
 * The coach uniform survey (/survey). One definition shared by the form and by
 * /api/join, so the server only accepts answers the form could have sent and
 * every response lands in TEGO with the same wording — which is what makes the
 * results countable.
 *
 * Changing an option's label changes what new responses store. Add options at
 * the end rather than rewording old ones, or old and new answers won't group.
 */

export const SURVEY_SLUG = "coach-uniforms-2026";

export type SurveyQuestion = {
  key: "lastPurchase" | "limitingFactor" | "nextOrder";
  label: string;
  options: readonly string[];
  /** Offer a free-text "Other". */
  other?: boolean;
  /** Pick any that apply (stored joined with "; " and as one tag per pick). */
  multi?: boolean;
};

export const SURVEY_QUESTIONS: readonly SurveyQuestion[] = [
  {
    key: "lastPurchase",
    label: "When did your program last buy new uniforms?",
    options: ["Within the last year", "1–2 years ago", "3–4 years ago", "5+ years ago", "Not sure"],
  },
  {
    key: "limitingFactor",
    label: "What holds you back from buying new uniforms?",
    options: [
      "Budget / cost",
      "Minimum order sizes",
      "Lead time to delivery",
      "Sizing and fit",
      "Design and customization options",
      "School or district approval",
      "Current uniforms still work",
    ],
    other: true,
    multi: true,
  },
  {
    key: "nextOrder",
    label: "When do you expect to place your next uniform order?",
    options: ["In the next 3 months", "3–6 months", "6–12 months", "More than a year out", "No plans yet"],
  },
] as const;

export const COACH_ROLES = ["Head coach", "Assistant coach", "Athletic director", "Other"] as const;
export const PROGRAMS = ["Track & field", "Cross country", "Both"] as const;

export const OTHER = "Other";

export const OPT_IN_LABEL = "I'd be interested in being contacted in the future for team kit offers.";

/** "Budget / cost" → "budget-cost", for one TEGO tag per limiting factor. */
export function answerSlug(answer: string): string {
  return answer.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** "When's your next order?" as a rough expected close date for the CRM deal. */
export function expectedCloseFor(nextOrder: string, now = new Date()): Date | null {
  const days: Record<string, number> = {
    "In the next 3 months": 45,
    "3–6 months": 135,
    "6–12 months": 270,
    "More than a year out": 450,
  };
  const d = days[nextOrder];
  return d ? new Date(now.getTime() + d * 86_400_000) : null;
}
