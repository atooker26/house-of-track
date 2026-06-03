"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

export default function GuestForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      discipline: (form.elements.namedItem("discipline") as HTMLSelectElement).value,
      story: (form.elements.namedItem("story") as HTMLTextAreaElement).value,
      _hp: (form.elements.namedItem("_hp") as HTMLInputElement).value,
    };

    try {
      const res = await fetch("/api/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
        <h3 style={{ fontFamily: "var(--font-cond)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em", fontSize: "var(--t-h3)", lineHeight: 1.1, margin: "0 0 var(--s-3)" }}>Thank you</h3>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--fg-2)" }}>Your story is now part of a bigger conversation. We&apos;ll be in touch soon.</p>
        <div style={{ marginTop: 14 }}>
          <span className="toast">&#10003; Application received</span>
        </div>
      </div>
    );
  }

  return (
    <div className="formcard">
      <form onSubmit={handleSubmit}>
        <p className="eyebrow" style={{ margin: 0 }}>Guest application</p>
        <h3 style={{ fontFamily: "var(--font-cond)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em", fontSize: "var(--t-h3)", lineHeight: 1.1, marginTop: 8, marginBottom: 22 }}>Tell us your story</h3>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" name="name" required placeholder="Your name" />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" required type="email" placeholder="you@email.com" />
        </div>
        <div className="field">
          <label htmlFor="discipline">Discipline</label>
          <select id="discipline" name="discipline">
            <option value="">Select one</option>
            <option>Sprint</option>
            <option>Distance</option>
            <option>Field</option>
            <option>Hurdles</option>
            <option>Other</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="story">What&apos;s your story?</label>
          <textarea id="story" name="story" rows={3} placeholder="A pivotal moment, on or off the track..." />
        </div>
        <input type="text" name="_hp" autoComplete="off" style={{ position: "absolute", left: -9999 }} tabIndex={-1} aria-hidden="true" />
        {error && <p style={{ color: "#c0392b", fontFamily: "var(--font-body)", fontSize: 14, margin: "0 0 14px" }}>{error}</p>}
        <button type="submit" className="btn btn-accent btn-lg" disabled={submitting}>
          {submitting ? "Sending..." : "Submit application"} <Icon name="arrow" size={16} />
        </button>
      </form>
    </div>
  );
}
