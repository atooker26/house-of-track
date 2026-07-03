"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

export default function Subscribe() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
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
    } catch {
      /* keep the CTA usable on failure */
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <p className="toast" style={{ color: "var(--cream)" }}>
        &#10003; You&apos;re subscribed — the weekly recap is on its way.
      </p>
    );
  }

  return (
    <form className="subscribe" onSubmit={handleSubmit}>
      <input
        name="email"
        type="email"
        required
        placeholder="you@email.com"
        aria-label="Email address"
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
        {submitting ? "..." : "Subscribe"} <Icon name="mail" size={16} />
      </button>
    </form>
  );
}
