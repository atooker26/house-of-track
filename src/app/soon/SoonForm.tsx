"use client";

import { useState } from "react";

export default function SoonForm() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(false);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const hp = (form.elements.namedItem("_hp") as HTMLInputElement).value;

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formType: "newsletter", email, _hp: hp }),
      });
      if (res.ok) setSent(true);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    // The form unmounts on success, so focus lands on <body> with nothing
    // announced. role="status" makes the one interaction on this page audible.
    return (
      <p className="gate-confirm" role="status" aria-live="polite" tabIndex={-1}>
        &#10003; You&apos;re on the list. We&apos;ll be in touch.
      </p>
    );
  }

  return (
    <form className="gate-form" onSubmit={handleSubmit}>
      <input
        name="email"
        type="email"
        required
        placeholder="you@email.com"
        aria-label="Email address"
        autoComplete="email"
      />
      <input
        type="text"
        name="_hp"
        autoComplete="off"
        style={{ position: "absolute", left: -9999 }}
        tabIndex={-1}
        aria-hidden="true"
      />
      <button type="submit" className="btn btn-cream btn-lg" disabled={submitting}>
        {submitting ? "…" : "Notify me"}
      </button>
      {error && (
        <p className="gate-error" role="alert">
          That didn&apos;t go through. Try again in a moment.
        </p>
      )}
    </form>
  );
}
