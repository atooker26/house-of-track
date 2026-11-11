"use client";

import { useState } from "react";
import type { ActionResult } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/client";
import Msg from "./Msg";

const MIN = 10;

export default function PasswordForm({ email }: { email: string }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<ActionResult | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < MIN) return setR({ ok: false, error: `Use at least ${MIN} characters.` });
    if (pw !== confirm) return setR({ ok: false, error: "The two passwords don't match." });
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setR({ ok: false, error: error.message });
    setPw("");
    setConfirm("");
    setR({ ok: true, message: "Password saved." });
  }

  return (
    <form className="adm-form" onSubmit={save}>
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <div className="adm-field">
        <label htmlFor="pw">New password</label>
        <input className="adm-input" id="pw" type="password" autoComplete="new-password" minLength={MIN} required value={pw} onChange={(e) => setPw(e.target.value)} />
      </div>
      <div className="adm-field">
        <label htmlFor="pw2">Confirm</label>
        <input className="adm-input" id="pw2" type="password" autoComplete="new-password" minLength={MIN} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <div className="adm-actions">
        <button className="adm-btn primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save password"}
        </button>
      </div>
      <Msg r={r} />
    </form>
  );
}
