"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

type Role = "creative" | "athlete";

export default function JoinForms() {
  const [role, setRole] = useState<Role>("creative");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const form = e.currentTarget;
    const get = (n: string) =>
      (form.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null)?.value ?? "";

    const data =
      role === "creative"
        ? {
            formType: "creative-signup",
            role,
            name: get("name"),
            email: get("email"),
            craft: get("craft"),
            location: get("location"),
            portfolio: get("portfolio"),
            _hp: get("_hp"),
          }
        : {
            formType: "athlete-signup",
            role,
            name: get("name"),
            email: get("email"),
            eventGroup: get("eventGroup"),
            meets: get("meets"),
            photoConsent: (form.elements.namedItem("photoConsent") as HTMLInputElement)?.checked
              ? "yes"
              : "no",
            _hp: get("_hp"),
          };

    try {
      const res = await fetch("/api/join", {
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
        <img
          src="/assets/logo-mark-navy-ink.png"
          alt="House of Track"
          style={{ height: 64, margin: "0 auto 18px" }}
        />
        <h3
          style={{
            fontFamily: "var(--font-cond)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.02em",
            fontSize: "var(--t-h3)",
            lineHeight: 1.1,
            margin: "0 0 var(--s-3)",
          }}
        >
          You&apos;re on the list
        </h3>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--fg-2)" }}>
          {role === "creative"
            ? "We'll be in touch about credentials and your first shoot."
            : "We'll notify you when creatives capture you at your meets."}
        </p>
        <div style={{ marginTop: 14 }}>
          <span className="toast">&#10003; Received</span>
        </div>
      </div>
    );
  }

  return (
    <div className="formcard">
      <div className="role-toggle" role="group" aria-label="Join as">
        <button
          type="button"
          className={role === "creative" ? "active" : ""}
          aria-pressed={role === "creative"}
          onClick={() => setRole("creative")}
        >
          I&apos;m a creative
        </button>
        <button
          type="button"
          className={role === "athlete" ? "active" : ""}
          aria-pressed={role === "athlete"}
          onClick={() => setRole("athlete")}
        >
          I&apos;m an athlete
        </button>
      </div>

      <form onSubmit={handleSubmit} key={role}>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" name="name" required placeholder="Your name" />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" required type="email" placeholder="you@email.com" />
        </div>

        {role === "creative" ? (
          <>
            <div className="field">
              <label htmlFor="craft">What you shoot</label>
              <select id="craft" name="craft">
                <option value="">Select one</option>
                <option>Photographer</option>
                <option>Videographer</option>
                <option>Designer</option>
                <option>Multiple</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="location">Based in</label>
              <input id="location" name="location" placeholder="City, State" />
            </div>
            <div className="field">
              <label htmlFor="portfolio">Portfolio / Instagram</label>
              <input id="portfolio" name="portfolio" placeholder="Link to your work" />
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="eventGroup">Your events</label>
              <select id="eventGroup" name="eventGroup">
                <option value="">Select one</option>
                <option>Sprints</option>
                <option>Distance</option>
                <option>Field</option>
                <option>Hurdles</option>
                <option>Multi / Combined</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="meets">Meets you compete at</label>
              <input id="meets" name="meets" placeholder="Prefontaine, USATFs, Portland Track..." />
            </div>
            <div className="consent">
              <input id="photoConsent" name="photoConsent" type="checkbox" defaultChecked />
              <label htmlFor="photoConsent">
                Notify me when a creative captures me at a meet. House of Track may use facial
                recognition to match and alert me. I can opt out anytime.
              </label>
            </div>
          </>
        )}

        <input
          type="text"
          name="_hp"
          autoComplete="off"
          style={{ position: "absolute", left: -9999 }}
          tabIndex={-1}
          aria-hidden="true"
        />
        {error && (
          <p style={{ color: "#c0392b", fontFamily: "var(--font-body)", fontSize: 14, margin: "0 0 14px" }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-accent btn-lg" disabled={submitting}>
          {submitting ? "Sending..." : role === "creative" ? "Join as a creative" : "Join as an athlete"}{" "}
          <Icon name="arrow" size={16} />
        </button>
      </form>
    </div>
  );
}
