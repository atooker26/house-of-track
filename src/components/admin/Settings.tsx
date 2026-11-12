"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/admin/auth";
import { addAlertRecipient, removeAlertRecipient, sendTestAlert } from "@/lib/admin/actions/settings";
import Msg from "./Msg";

export function AlertRow({ email, canTest }: { email: string; canTest: boolean }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [r, setR] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <tr>
      <td>
        <strong>{email}</strong>
        <Msg r={r} />
      </td>
      <td className="num">
        <span className="adm-actions" style={{ justifyContent: "flex-end" }}>
          {canTest && (
            <button type="button" className="adm-btn ghost sm" disabled={pending} onClick={() => start(async () => setR(await sendTestAlert(email)))}>
              Send test
            </button>
          )}
          {!armed ? (
            <button type="button" className="adm-btn danger sm" onClick={() => setArmed(true)}>
              Remove…
            </button>
          ) : (
            <button
              type="button"
              className="adm-btn danger sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setR(await removeAlertRecipient(email));
                  setArmed(false);
                  router.refresh();
                })
              }
            >
              Yes, remove
            </button>
          )}
        </span>
      </td>
    </tr>
  );
}

export function AddAlertRecipient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [r, setR] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="adm-form"
      style={{ marginTop: 16 }}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await addAlertRecipient(email);
          setR(res);
          if (res.ok) {
            setEmail("");
            router.refresh();
          }
        });
      }}
    >
      <div className="adm-field" style={{ maxWidth: 420 }}>
        <label htmlFor="new-alert">Add someone</label>
        <input className="adm-input" id="new-alert" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        <span className="hint">They don&rsquo;t need an admin login.</span>
      </div>
      <div className="adm-actions">
        <button className="adm-btn primary" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      <Msg r={r} />
    </form>
  );
}
