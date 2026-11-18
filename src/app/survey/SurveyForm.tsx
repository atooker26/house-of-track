"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { COACH_ROLES, OTHER, PROGRAMS, SURVEY_QUESTIONS } from "@/lib/survey";

type Answers = Record<string, string>;

export default function SurveyForm() {
  const [answers, setAnswers] = useState<Answers>({});
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function pick(key: string, value: string) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const missing = SURVEY_QUESTIONS.find((q) => !answers[q.key]);
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
          limitingFactorOther: answers.limitingFactor === OTHER ? val("limitingFactorOther") : "",
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
              {q.label}
            </legend>
            <div className="choices" role="radiogroup">
              {[...q.options, ...(q.other ? [OTHER] : [])].map((opt) => (
                <label key={opt} className={`choice${answers[q.key] === opt ? " is-on" : ""}`}>
                  <input
                    type="radio"
                    name={q.key}
                    value={opt}
                    checked={answers[q.key] === opt}
                    onChange={() => pick(q.key, opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
            {q.other && answers[q.key] === OTHER && (
              <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                <label htmlFor={`${q.key}Other`}>Tell us more</label>
                <input id={`${q.key}Other`} name={`${q.key}Other`} maxLength={300} placeholder="What gets in the way?" />
              </div>
            )}
          </fieldset>
        ))}

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
            Send me House of Track news, including team kit offers.
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
