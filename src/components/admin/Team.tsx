"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/admin/auth";
import { addAdmin, removeAdmin, resendInvite } from "@/lib/admin/actions/team";
import Msg from "./Msg";

export function AdminRow({ userId, email, since, isMe, canInvite }: { userId: string; email: string; since: string; isMe: boolean; canInvite: boolean }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [r, setR] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <tr>
      <td>
        <strong>{email}</strong> {isMe && <span className="adm-sub">(you)</span>}
        <div className="adm-sub">Since {since}</div>
        <Msg r={r} />
      </td>
      <td className="num">
        {!isMe && (
          <span className="adm-actions" style={{ justifyContent: "flex-end" }}>
            {canInvite && (
              <button type="button" className="adm-btn ghost sm" disabled={pending} onClick={() => start(async () => setR(await resendInvite(userId)))}>
                Send login link
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
                    const res = await removeAdmin(userId);
                    setR(res);
                    setArmed(false);
                    router.refresh();
                  })
                }
              >
                Yes, remove
              </button>
            )}
          </span>
        )}
      </td>
    </tr>
  );
}

export function AddAdmin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [r, setR] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="adm-form"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await addAdmin(email);
          setR(res);
          if (res.ok) {
            setEmail("");
            router.refresh();
          }
        });
      }}
    >
      <div className="adm-field" style={{ maxWidth: 420 }}>
        <label htmlFor="new-admin">Email</label>
        <input className="adm-input" id="new-admin" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        <span className="hint">They get an email from TEGO with a link to set their password.</span>
      </div>
      <div className="adm-actions">
        <button className="adm-btn primary" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add admin"}
        </button>
      </div>
      <Msg r={r} />
    </form>
  );
}
