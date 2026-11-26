"use client";

import { useState } from "react";
import { trackFormSubmit } from "@/lib/tego-conversions";
import Icon from "@/components/Icon";
import { COACH_ROLES, OPT_IN_LABEL, OTHER, PROGRAMS, SURVEY_QUESTIONS } from "@/lib/survey";

/** One answer for single-choice questions, a list for pick-any ones. */
type Answers = Record<string, string | string[]>;

const has = (a: string | string[] | undefined, opt: string) => (Array.isArray(a) ? a.includes(opt) : a === opt);
const answered = (a: string | string[] | undefined) => (Array.isArray(a) ? a.length > 0 : Boolean(a));

export default function SurveyForm() {
  const [answers, setAnswers] = useState<Answers>({});
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function pick(key: string, value: string, multi: boolean) {
    setAnswers((a) => {
      if (!multi) return { ...a, [key]: value };
      const cur = Array.isArray(a[key]) ? (a[key] as string[]) : [];
      return { ...a, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const missing = SURVEY_QUESTIONS.find((q) => !answered(answers[q.key]));
    if (missing) {
      setError(`Pick an answer for: ${missing.label}`);
      return;
    }

    const form = e.currentTarget;
    const val = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";
    setSubmitting(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: "coach-survey",
          ...answers,
          limitingFactorOther: has(answers.limitingFactor, OTHER) ? val("limitingFactorOther") : "",
          comments: val("comments"),
          name: val("name"),
          email: val("email"),
          school: val("school"),
          state: val("state"),
          coachRole: val("coachRole"),
          program: val("program"),
          optIn: (form.elements.namedItem("optIn") as HTMLInputElement).checked,
          _hp: val("_hp"),
        }),
      });
      if (!res.ok) throw new Error("Submission failed");
      trackFormSubmit("coach-survey", "Coach survey");
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="formcard" style={{ textAlign: "center", padding: "40px 32px" }}>
        <img src="/assets/logo-mark-navy-ink.png" alt="House of Track" style={{ height: 64, margin: "0 auto 18px" }} />
        <h3 className="survey-h">Thanks, coach</h3>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--fg-2)" }}>
          That&apos;s all we needed. We read every answer.
        </p>
        <div style={{ marginTop: 14 }}>
          <span className="toast">&#10003; Response received</span>
        </div>
      </div>
    );
  }

  return (
    <div className="formcard">
      <form onSubmit={handleSubmit}>
        {SURVEY_QUESTIONS.map((q, i) => (
          <fieldset key={q.key} className="survey-q">
            <legend>
              <span className="survey-num">{i + 1}</span>
              <span>
                {q.label}
                {q.multi ? <span className="survey-hint">Pick any that apply</span> : null}
              </span>
            </legend>
            <div className="choices" role={q.multi ? "group" : "radiogroup"}>
              {[...q.options, ...(q.other ? [OTHER] : [])].map((opt) => (
                <label key={opt} className={`choice${has(answers[q.key], opt) ? " is-on" : ""}`}>
                  <input
                    type={q.multi ? "checkbox" : "radio"}
                    name={q.key}
                    value={opt}
                    checked={has(answers[q.key], opt)}
                    onChange={() => pick(q.key, opt, Boolean(q.multi))}
                  />
                  {opt}
                </label>
              ))}
            </div>
            {q.other && has(answers[q.key], OTHER) && (
              <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                <label htmlFor={`${q.key}Other`}>Tell us more</label>
                <input id={`${q.key}Other`} name={`${q.key}Other`} maxLength={300} placeholder="What gets in the way?" />
              </div>
            )}
          </fieldset>
        ))}

        <div className="field" style={{ marginBottom: 28 }}>
          <label htmlFor="comments">
            Additional comments or frustrations with this process <span className="survey-hint">Completely optional</span>
          </label>
          <textarea id="comments" name="comments" rows={4} maxLength={2000} placeholder="Anything else we should know?" />
        </div>

        <div className="survey-about">
          <p className="eyebrow" style={{ margin: "0 0 14px" }}>About you</p>
          <div className="survey-grid">
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" required autoComplete="name" placeholder="Coach name" />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" required type="email" autoComplete="email" placeholder="you@school.org" />
            </div>
            <div className="field">
              <label htmlFor="school">School</label>
              <input id="school" name="school" required placeholder="High school" />
            </div>
            <div className="field">
              <label htmlFor="state">State</label>
              <input id="state" name="state" required maxLength={30} autoComplete="address-level1" placeholder="OR" />
            </div>
            <div className="field">
              <label htmlFor="coachRole">Your role</label>
              <select id="coachRole" name="coachRole" defaultValue="">
                <option value="">Select one</option>
                {COACH_ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="program">Program</label>
              <select id="program" name="program" defaultValue="">
                <option value="">Select one</option>
                {PROGRAMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="survey-optin">
            <input name="optIn" type="checkbox" />
            {OPT_IN_LABEL}
          </label>
        </div>

        <input type="text" name="_hp" autoComplete="off" style={{ position: "absolute", left: -9999 }} tabIndex={-1} aria-hidden="true" />
        {error && <p style={{ color: "#c0392b", fontFamily: "var(--font-body)", fontSize: 14, margin: "0 0 14px" }}>{error}</p>}
        <button type="submit" className="btn btn-accent btn-lg" disabled={submitting}>
          {submitting ? "Sending..." : "Submit"} <Icon name="arrow" size={16} />
        </button>
      </form>
    </div>
  );
}
