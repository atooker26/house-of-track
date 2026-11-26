"use client";

import { useState } from "react";
import { trackFormSubmit } from "@/lib/tego-conversions";
import Icon from "@/components/Icon";

/** "Email me when it drops" for the featured item before it's in the shop. */
export default function DropNotify({ dropSlug }: { dropSlug: string }) {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(false);
    setSubmitting(true);
    const form = e.currentTarget;
    const val = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value;
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formType: "drop-notify", dropSlug, email: val("email"), _hp: val("_hp") }),
      });
      if (!res.ok) throw new Error();
      trackFormSubmit("drop-notify", "Notify me (drop)");
      setSent(true);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) return <span className="toast">&#10003; We&apos;ll email you when it drops</span>;

  return (
    <form className="notify-form" onSubmit={handleSubmit}>
      <input name="email" type="email" required aria-label="Email" placeholder="Email" autoComplete="email" />
      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? "..." : "Email me when it drops"} <Icon name="bell" size={15} />
      </button>
      <input type="text" name="_hp" autoComplete="off" style={{ position: "absolute", left: -9999 }} tabIndex={-1} aria-hidden="true" />
      {error && <p className="join-error" style={{ color: "#c0392b" }}>Something went wrong. Try again.</p>}
    </form>
  );
}
