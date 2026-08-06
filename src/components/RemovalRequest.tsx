"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

/**
 * "This is me, take it down."
 *
 * Every profile on this site is built from public data about someone who never
 * asked for it, as an act of recruitment. That needs a graceful no. Requests land
 * in the same TEGO inbox as the join forms so they can't be quietly missed, and
 * acting on one means setting `optedOut: true` in data/people.json — which removes
 * the page AND stops the ingest re-adding their videos on the next run.
 */
export default function RemovalRequest({ slug, name }: { slug: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const form = e.currentTarget;
    const get = (n: string) =>
      (form.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "";

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: "profile-removal",
          profileSlug: slug,
          profileName: name,
          email: get("email"),
          message: get("message"),
          _hp: get("_hp"),
        }),
      });
      if (!res.ok) throw new Error("failed");
      setSent(true);
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <p className="removal-note removal-sent">
        <Icon name="check" size={14} /> Request received. We&apos;ll take this profile down.
      </p>
    );
  }

  if (!open) {
    return (
      <p className="removal-note">
        <button type="button" className="removal-toggle" onClick={() => setOpen(true)}>
          Not you, or want this removed?
        </button>
      </p>
    );
  }

  return (
    <form className="removal-form" onSubmit={handleSubmit}>
      <p className="removal-form-lead">
        We&apos;ll remove this profile and stop including {name}&apos;s work. No explanation needed.
      </p>
      <input
        type="text"
        name="_hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px" }}
      />
      <div className="removal-row">
        <input type="email" name="email" placeholder="Your email" required aria-label="Your email" />
        <button type="submit" className="btn btn-cream" disabled={submitting}>
          {submitting ? "Sending…" : "Request removal"}
        </button>
      </div>
      <textarea name="message" rows={2} placeholder="Anything you want to add (optional)" aria-label="Message" />
      {error && <p className="removal-error">{error}</p>}
    </form>
  );
}
