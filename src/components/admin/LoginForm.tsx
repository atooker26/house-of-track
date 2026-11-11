"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { requestPasswordReset } from "@/lib/admin/actions/team";

export default function LoginForm({ badLink }: { badLink: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "forgot">(badLink ? "forgot" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(badLink ? "That link expired or was already used. Send a new one." : "");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    if (mode === "forgot") {
      const r = await requestPasswordReset(email);
      setBusy(false);
      if (!r.ok) return setError(r.error);
      return setSent(true);
    }
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
    router.push("/admin");
    router.refresh();
  }

  function switchTo(next: "signin" | "forgot") {
    setMode(next);
    setError("");
    setSent(false);
  }

  return (
    <form onSubmit={onSubmit} className="adm-form">
      <div>
        <h1>{mode === "forgot" ? "Reset password" : "Shop admin"}</h1>
        <p className="sub">
          {mode === "forgot"
            ? "Enter your admin email and we'll send you a link to set a new password."
            : "Drops, orders and shipping for House of Track."}
        </p>
      </div>
      <div className="adm-field">
        <label htmlFor="email">Email</label>
        <input className="adm-input" id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {mode === "signin" && (
        <div className="adm-field">
          <label htmlFor="password">Password</label>
          <input
            className="adm-input"
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      )}
      {error && (
        <p className="adm-msg err" role="alert">
          {error}
        </p>
      )}
      {sent && <p className="adm-msg ok">If that email is an admin, a link is on its way. It expires in an hour.</p>}
      <button className="adm-btn primary" type="submit" disabled={busy}>
        {busy ? "One moment…" : mode === "forgot" ? "Email me a link" : "Sign in"}
      </button>
      <p style={{ margin: 0, fontSize: 14 }}>
        {mode === "signin" ? (
          <button type="button" className="adm-linkbtn" onClick={() => switchTo("forgot")}>
            Forgot password?
          </button>
        ) : (
          <button type="button" className="adm-linkbtn" onClick={() => switchTo("signin")}>
            Back to sign in
          </button>
        )}
      </p>
    </form>
  );
}
