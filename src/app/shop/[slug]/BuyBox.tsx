"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

type Variant = { id: number; label: string; available: number | null; heldOnly: boolean };

const MAX_QTY = 5;

/**
 * Variant picker, quantity and Buy. Buy goes straight to Stripe Checkout: one
 * item per order keeps a limited drop simple (no cart to hold stock in).
 */
export default function BuyBox({
  variants,
  canBuy,
  closedLabel,
}: {
  variants: Variant[];
  canBuy: boolean;
  /** Why buying is off, when it is: "Opening soon", "Drop opens …", "This drop has ended". */
  closedLabel: string | null;
}) {
  const firstAvailable = variants.find((v) => v.available !== 0) ?? null;
  const [variantId, setVariantId] = useState<number | null>(variants.length === 1 ? (firstAvailable?.id ?? null) : null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = variants.find((v) => v.id === variantId) ?? null;
  const maxQty = Math.min(MAX_QTY, selected?.available ?? MAX_QTY);
  const allGone = variants.length === 0 || variants.every((v) => v.available === 0);
  const someHeld = variants.some((v) => v.heldOnly);

  async function buy() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: selected.id, qty }),
      });
      const json = (await res.json().catch(() => null)) as { checkoutUrl?: string; error?: { message?: string } } | null;
      if (res.ok && json?.checkoutUrl) {
        window.location.assign(json.checkoutUrl);
        return;
      }
      setError(json?.error?.message ?? "Something went wrong. Try again.");
    } catch {
      setError("Couldn't reach the shop. Check your connection and try again.");
    }
    setBusy(false);
  }

  // The button always says why it can't be pressed.
  let label: string;
  let disabled = true;
  if (!canBuy) label = closedLabel ?? "Not on sale";
  else if (allGone) label = "Sold out";
  else if (!selected) label = "Pick a size";
  else if (selected.available === 0) label = "Sold out in this size";
  else if (busy) label = "Opening checkout…";
  else {
    label = "Buy now";
    disabled = false;
  }

  return (
    <div className="buybox">
      {variants.length > 1 ? (
        <fieldset className="buybox-sizes">
          <legend className="buybox-legend">Size</legend>
          <div className="buybox-chips">
            {variants.map((v) => {
              const gone = v.available === 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  className={`buybox-chip${v.id === variantId ? " is-on" : ""}${gone ? " is-gone" : ""}`}
                  aria-pressed={v.id === variantId}
                  onClick={() => {
                    setVariantId(v.id);
                    setQty(1);
                  }}
                >
                  {v.label}
                  {gone ? <span className="sr-only"> (sold out)</span> : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {canBuy && !allGone ? (
        <div className="buybox-qty">
          <span className="buybox-legend" id="qty-label">
            Quantity
          </span>
          <div className="buybox-stepper" role="group" aria-labelledby="qty-label">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="One fewer">
              −
            </button>
            <span aria-live="polite">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              disabled={qty >= maxQty}
              aria-label="One more"
            >
              +
            </button>
          </div>
          {selected?.available !== null && selected?.available !== undefined && selected.available <= 10 && selected.available > 0 ? (
            <span className="buybox-left">Only {selected.available} left</span>
          ) : null}
        </div>
      ) : null}

      <button type="button" className="btn btn-primary btn-lg buybox-buy" onClick={buy} disabled={disabled} aria-disabled={disabled}>
        {label} {disabled ? null : <Icon name="arrow" size={16} />}
      </button>
      {error ? (
        <p className="buybox-error" role="alert">
          {error}
        </p>
      ) : null}
      {allGone && someHeld ? (
        <p className="buybox-note">A few are held in open checkouts. Any that aren&apos;t bought come back within 30 minutes.</p>
      ) : null}
    </div>
  );
}
