"use client";

import { useState } from "react";

/**
 * "Email me when it drops." Shown when the product can't be bought right now: before
 * the drop opens, while checkout is off, or once it's sold out. The address lands in
 * TEGO tagged with this drop, so the launch email can go to exactly these people.
 */
export default function NotifyForm({ dropSlug, soldOut }: { dropSlug: string; soldOut: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const hp = (form.elements.namedItem("_hp") as HTMLInputElement).value;
    setState("busy");
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formType: "drop-notify", dropSlug, email, _hp: hp }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="notify-done" role="status">
        You&apos;re on the list. We&apos;ll email you {soldOut ? "if more come in" : "the moment it opens"}.
      </p>
    );
  }

  return (
    <form className="notify" onSubmit={submit}>
      <label htmlFor="notify-email" className="buybox-legend">
        {soldOut ? "Email me if more come in" : "Email me when it drops"}
      </label>
      <div className="notify-row">
        <input id="notify-email" name="email" type="email" required placeholder="you@email.com" autoComplete="email" />
        <input type="text" name="_hp" autoComplete="off" style={{ position: "absolute", left: -9999 }} tabIndex={-1} aria-hidden="true" />
        <button type="submit" className="btn btn-primary" disabled={state === "busy"}>
          {state === "busy" ? "…" : "Notify me"}
        </button>
      </div>
      {state === "error" ? (
        <p className="buybox-error" role="alert">
          That didn&apos;t go through. Try again in a minute.
        </p>
      ) : null}
    </form>
  );
}
