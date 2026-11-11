"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/admin/auth";
import { deleteProduct, updateProduct } from "@/lib/admin/actions/catalog";
import { dollarsToCents } from "./DropForm";
import Msg from "./Msg";

type Values = { name: string; slug: string; description: string; price: string; active: boolean; sort: string };

export function ProductDetails({ id, initial, hasOrders }: { id: number; initial: Values; hasOrders: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [r, setR] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <form
      className="adm-form"
      onSubmit={(e) => {
        e.preventDefault();
        const priceCents = dollarsToCents(v.price);
        if (Number.isNaN(priceCents)) return setR({ ok: false, error: "Price should be a dollar amount, like 40" });
        start(async () => {
          setR(
            await updateProduct(id, {
              name: v.name,
              slug: v.slug,
              description: v.description,
              priceCents,
              active: v.active,
              sort: Number(v.sort) || 0,
            }),
          );
          router.refresh();
        });
      }}
    >
      <div className="adm-row">
        <div className="adm-field">
          <label htmlFor="p-name">Name</label>
          <input className="adm-input" id="p-name" required value={v.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="adm-field">
          <label htmlFor="p-price">Price</label>
          <div className="adm-prefix">
            <span>$</span>
            <input className="adm-input" id="p-price" required inputMode="decimal" value={v.price} onChange={(e) => set("price", e.target.value)} />
          </div>
          {hasOrders && <span className="hint">Changing it doesn&rsquo;t touch past orders.</span>}
        </div>
      </div>
      <div className="adm-field">
        <label htmlFor="p-desc">Description</label>
        <textarea id="p-desc" value={v.description} maxLength={4000} onChange={(e) => set("description", e.target.value)} placeholder="Fabric, fit, what makes it." />
        <span className="hint">Blank lines start a new paragraph.</span>
      </div>
      <div className="adm-row three">
        <div className="adm-field">
          <label htmlFor="p-slug">Link</label>
          <div className="adm-prefix">
            <span>/shop/</span>
            <input className="adm-input" id="p-slug" required value={v.slug} onChange={(e) => set("slug", e.target.value)} />
          </div>
          {hasOrders && <span className="hint">Changing it breaks links already shared.</span>}
        </div>
        <div className="adm-field">
          <label htmlFor="p-sort">Order on the page</label>
          <input className="adm-input" id="p-sort" inputMode="numeric" value={v.sort} onChange={(e) => set("sort", e.target.value)} />
          <span className="hint">Lower shows first.</span>
        </div>
        <div className="adm-field" style={{ alignContent: "center" }}>
          <label className="adm-check">
            <input type="checkbox" checked={v.active} onChange={(e) => set("active", e.target.checked)} />
            Show on the shop
          </label>
        </div>
      </div>
      <div className="adm-actions">
        <button className="adm-btn primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </button>
      </div>
      <Msg r={r} />
    </form>
  );
}

export function DeleteProduct({ id }: { id: number }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [r, setR] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="adm-card">
      <h2>Delete</h2>
      <div className="adm-actions">
        {!armed ? (
          <button className="adm-btn danger" type="button" onClick={() => setArmed(true)}>
            Delete product…
          </button>
        ) : (
          <>
            <span>Delete it and its sizes? Nobody has ordered it.</span>
            <button
              className="adm-btn danger"
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteProduct(id);
                  if (res.ok && res.dropId) router.push(`/admin/drops/${res.dropId}`);
                  else setR(res);
                })
              }
            >
              Yes, delete
            </button>
            <button className="adm-btn ghost" type="button" onClick={() => setArmed(false)}>
              Cancel
            </button>
          </>
        )}
      </div>
      <Msg r={r} />
    </section>
  );
}
