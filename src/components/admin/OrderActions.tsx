"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/admin/auth";
import { markShipped, markUnshipped, refundOrder, resendShipped, saveNote } from "@/lib/admin/actions/orders";
import Msg from "./Msg";

const CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "Other"] as const;
type Carrier = (typeof CARRIERS)[number];

export function ShipPanel({
  orderId,
  shipped,
  carrier,
  trackingNumber,
  hasEmail,
}: {
  orderId: number;
  shipped: boolean;
  carrier: string | null;
  trackingNumber: string | null;
  hasEmail: boolean;
}) {
  const [c, setC] = useState<Carrier>((CARRIERS as readonly string[]).includes(carrier ?? "") ? (carrier as Carrier) : "USPS");
  const [num, setNum] = useState(trackingNumber ?? "");
  const [notify, setNotify] = useState(hasEmail);
  const [r, setR] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>) => start(async () => setR(await fn()));

  return (
    <section className="adm-card">
      <h2>{shipped ? "Shipped" : "Ship it"}</h2>
      <form
        className="adm-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => markShipped({ orderId, carrier: c, trackingNumber: num, notify }));
        }}
      >
        <div className="adm-row">
          <div className="adm-field">
            <label htmlFor="carrier">Carrier</label>
            <select id="carrier" value={c} onChange={(e) => setC(e.target.value as Carrier)}>
              {CARRIERS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="adm-field">
            <label htmlFor="tracking">Tracking number</label>
            <input
              className="adm-input"
              id="tracking"
              value={num}
              onChange={(e) => setNum(e.target.value)}
              placeholder="Optional"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
        <label className="adm-check">
          <input type="checkbox" checked={notify} disabled={!hasEmail} onChange={(e) => setNotify(e.target.checked)} />
          {hasEmail ? "Email the buyer that it shipped" : "No buyer email on this order"}
        </label>
        <div className="adm-actions">
          <button className="adm-btn primary" type="submit" disabled={pending}>
            {pending ? "Saving…" : shipped ? "Update tracking" : "Mark shipped"}
          </button>
          {shipped && (
            <>
              <button type="button" className="adm-btn ghost" disabled={pending || !hasEmail} onClick={() => run(() => resendShipped(orderId))}>
                Resend email
              </button>
              <button type="button" className="adm-btn ghost" disabled={pending} onClick={() => run(() => markUnshipped(orderId))}>
                Not shipped yet
              </button>
            </>
          )}
        </div>
        <Msg r={r} />
      </form>
    </section>
  );
}

export function OrderNote({ orderId, note }: { orderId: number; note: string }) {
  const [v, setV] = useState(note);
  const [r, setR] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="adm-card">
      <h2>Internal note</h2>
      <form
        className="adm-form"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setR(await saveNote(orderId, v)));
        }}
      >
        <textarea aria-label="Internal note" value={v} onChange={(e) => setV(e.target.value)} placeholder="Only admins see this." maxLength={4000} />
        <div className="adm-actions">
          <button className="adm-btn ghost" type="submit" disabled={pending || v === note}>
            {pending ? "Saving…" : "Save note"}
          </button>
        </div>
        <Msg r={r} />
      </form>
    </section>
  );
}

/**
 * Two-step on purpose (no window.confirm): first click arms it, second refunds.
 * The refund is final in Stripe, so the armed state says exactly what will happen.
 */
export function RefundPanel({ orderId, total }: { orderId: number; total: string }) {
  const [armed, setArmed] = useState(false);
  const [restock, setRestock] = useState(true);
  const [r, setR] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="adm-card">
      <h2>Refund</h2>
      {!armed ? (
        <button className="adm-btn danger" type="button" onClick={() => setArmed(true)}>
          Refund {total}…
        </button>
      ) : (
        <div className="adm-form">
          <p className="adm-note" style={{ margin: 0 }}>
            Refunds the whole order ({total}) to the buyer&rsquo;s card. This can&rsquo;t be undone. The buyer sees it in 5–10 days.
          </p>
          <label className="adm-check">
            <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
            Put the units back on sale
          </label>
          <div className="adm-actions">
            <button
              className="adm-btn danger"
              type="button"
              disabled={pending}
              onClick={() => start(async () => setR(await refundOrder(orderId, restock)))}
            >
              {pending ? "Refunding…" : `Yes, refund ${total}`}
            </button>
            <button className="adm-btn ghost" type="button" disabled={pending} onClick={() => setArmed(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <Msg r={r} />
    </section>
  );
}
