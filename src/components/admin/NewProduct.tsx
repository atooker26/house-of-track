"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/admin/auth";
import { createProduct } from "@/lib/admin/actions/catalog";
import { dollarsToCents, slugify } from "./DropForm";
import Msg from "./Msg";

/** Name + price is enough to start; photos, sizes and stock are on the product page it opens. */
export default function NewProduct({ dropId, nextSort }: { dropId: number; nextSort: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [r, setR] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  if (!open)
    return (
      <div className="adm-actions" style={{ marginTop: 14 }}>
        <button className="adm-btn ghost" type="button" onClick={() => setOpen(true)}>
          + Add product
        </button>
      </div>
    );

  return (
    <form
      className="adm-form"
      style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--line)" }}
      onSubmit={(e) => {
        e.preventDefault();
        const priceCents = dollarsToCents(price);
        if (Number.isNaN(priceCents)) return setR({ ok: false, error: "Price should be a dollar amount, like 40" });
        start(async () => {
          const res = await createProduct(dropId, {
            name,
            slug: slugify(name),
            description: "",
            priceCents,
            active: true,
            sort: nextSort,
          });
          if (res.ok && res.id) router.push(`/admin/products/${res.id}`);
          else setR(res);
        });
      }}
    >
      <div className="adm-row">
        <div className="adm-field">
          <label htmlFor="np-name">Product name</label>
          <input className="adm-input" id="np-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Corduroy Hat" autoFocus />
          <span className="hint">The shop link becomes /shop/{slugify(name) || "…"}</span>
        </div>
        <div className="adm-field">
          <label htmlFor="np-price">Price</label>
          <div className="adm-prefix">
            <span>$</span>
            <input className="adm-input" id="np-price" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="40" />
          </div>
        </div>
      </div>
      <div className="adm-actions">
        <button className="adm-btn primary" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add and set up"}
        </button>
        <button className="adm-btn ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <Msg r={r} />
    </form>
  );
}
