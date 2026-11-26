"use client";

import { useState } from "react";
import { trackFormSubmit } from "@/lib/tego-conversions";
import Icon from "@/components/Icon";
import { NETWORK_ROLES, type NetworkRole } from "@/lib/constants";

/**
 * Join the Network: pick any of Creative / Athlete / Fan, leave a name and email.
 * Each pick becomes a TEGO contact tag, which is how the three lists are kept.
 */
export default function JoinNetwork() {
  const [roles, setRoles] = useState<NetworkRole[]>([]);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function toggle(id: NetworkRole) {
    setRoles((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (roles.length === 0) {
      setError("Pick at least one.");
      return;
    }
    const form = e.currentTarget;
    const val = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value;
    setSubmitting(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formType: "network-join", roles, name: val("name"), email: val("email"), _hp: val("_hp") }),
      });
      if (!res.ok) throw new Error("Submission failed");
      trackFormSubmit("network-join", "Join the network");
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="join-done">
        <span className="toast">&#10003; You&apos;re in the network</span>
        <p>We&apos;ll be in touch with what&apos;s next.</p>
      </div>
    );
  }

  return (
    <form className="join-form" onSubmit={handleSubmit}>
      <div className="join-roles" role="group" aria-label="I am a">
        {NETWORK_ROLES.map((r) => {
          const on = roles.includes(r.id);
          return (
            <button
              key={r.id}
              type="button"
              className={`join-role${on ? " is-on" : ""}`}
              aria-pressed={on}
              onClick={() => toggle(r.id)}
            >
              <span className="join-role-check" aria-hidden="true">
                {on ? <Icon name="check" size={14} /> : null}
              </span>
              <span className="join-role-label">{r.label}</span>
              <span className="join-role-sub">{r.sub}</span>
            </button>
          );
        })}
      </div>
      <div className="join-fields">
        <input name="name" aria-label="Name" placeholder="Name" autoComplete="name" />
        <input name="email" aria-label="Email" type="email" required placeholder="Email" autoComplete="email" />
        <button type="submit" className="btn btn-cream btn-lg" disabled={submitting}>
          {submitting ? "Joining..." : "Join"} <Icon name="arrow" size={16} />
        </button>
      </div>
      <input type="text" name="_hp" autoComplete="off" style={{ position: "absolute", left: -9999 }} tabIndex={-1} aria-hidden="true" />
      {error && <p className="join-error">{error}</p>}
    </form>
  );
}
