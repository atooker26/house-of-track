"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/admin/auth";
import { addVariant, deleteVariant, updateVariant } from "@/lib/admin/actions/catalog";
import type { VariantStock } from "@/lib/admin/queries";
import Msg from "./Msg";

function parseStock(s: string): number | null | "bad" {
  const t = s.trim();
  if (t === "" || t === "∞") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : "bad";
}

function Row({ v }: { v: VariantStock }) {
  const router = useRouter();
  const [label, setLabel] = useState(v.label);
  const [sku, setSku] = useState(v.sku);
  const [stock, setStock] = useState(v.stockQty === null ? "" : String(v.stockQty));
  const [r, setR] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const dirty = label !== v.label || sku !== v.sku || stock !== (v.stockQty === null ? "" : String(v.stockQty));

  return (
    <>
      <tr>
        <td>
          <input className="adm-input" aria-label="Size" value={label} onChange={(e) => setLabel(e.target.value)} />
        </td>
        <td>
          <input className="adm-input" aria-label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} spellCheck={false} />
        </td>
        <td>
          <input className="adm-input" aria-label="Stock" inputMode="numeric" value={stock} placeholder="Unlimited" onChange={(e) => setStock(e.target.value)} style={{ maxWidth: 110 }} />
        </td>
        <td className="num">{v.sold}</td>
        <td className="num">
          {v.available === null ? "∞" : v.available}
          {v.reserved > 0 && <div className="adm-sub">{v.reserved} held</div>}
        </td>
        <td className="num">
          <span className="adm-actions" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
            <button
              type="button"
              className="adm-btn sm"
              disabled={!dirty || pending}
              onClick={() => {
                const s = parseStock(stock);
                if (s === "bad") return setR({ ok: false, error: "Stock is a whole number, or blank for unlimited." });
                start(async () => {
                  setR(await updateVariant(v.id, { label, sku, stockQty: s, sort: v.sort }));
                  router.refresh();
                });
              }}
            >
              Save
            </button>
            {v.sold === 0 && v.reserved === 0 && (
              <button
                type="button"
                className="adm-btn danger sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteVariant(v.id);
                    if (!res.ok) setR(res);
                    router.refresh();
                  })
                }
              >
                Remove
              </button>
            )}
          </span>
        </td>
      </tr>
      {r && (!r.ok || r.message) && (
        <tr>
          <td colSpan={6} style={{ paddingTop: 0 }}>
            <Msg r={r} />
          </td>
        </tr>
      )}
    </>
  );
}

const QUICK = ["One size", "S", "M", "L", "XL"];

export default function Variants({ productId, productSlug, variants }: { productId: number; productSlug: string; variants: VariantStock[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [sku, setSku] = useState("");
  const [stock, setStock] = useState("");
  const [r, setR] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const skuFor = (l: string) =>
    `HOT-${productSlug}-${l}`
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/-+$/, "")
      .slice(0, 60);

  return (
    <div className="adm-form">
      {variants.length > 0 ? (
        <div className="adm-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Size</th>
                <th>SKU</th>
                <th>Stock</th>
                <th className="num">Sold</th>
                <th className="num">Left</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <Row key={`${v.id}-${v.stockQty}-${v.sold}-${v.label}-${v.sku}`} v={v} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="adm-note" style={{ margin: 0 }}>
          No sizes yet, so nobody can buy it. A hat with one size still needs one: &ldquo;One size&rdquo;.
        </p>
      )}

      <form
        className="adm-form"
        style={{ paddingTop: 14, borderTop: "1px solid var(--line)" }}
        onSubmit={(e) => {
          e.preventDefault();
          const s = parseStock(stock);
          if (s === "bad") return setR({ ok: false, error: "Stock is a whole number, or blank for unlimited." });
          start(async () => {
            const res = await addVariant(productId, { label, sku: sku || skuFor(label), stockQty: s, sort: variants.length });
            setR(res);
            if (res.ok) {
              setLabel("");
              setSku("");
              setStock("");
              router.refresh();
            }
          });
        }}
      >
        <span className="adm-label">Add a size</span>
        <div className="adm-actions">
          {QUICK.filter((q) => !variants.some((v) => v.label.toLowerCase() === q.toLowerCase())).map((q) => (
            <button key={q} type="button" className="adm-btn ghost sm" onClick={() => setLabel(q)}>
              {q}
            </button>
          ))}
        </div>
        <div className="adm-row three">
          <div className="adm-field">
            <label htmlFor="v-label">Size</label>
            <input className="adm-input" id="v-label" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="M" />
          </div>
          <div className="adm-field">
            <label htmlFor="v-sku">SKU</label>
            <input className="adm-input" id="v-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder={label ? skuFor(label) : "Auto"} spellCheck={false} />
            <span className="hint">Blank = {label ? skuFor(label) : "made from the product and size"}.</span>
          </div>
          <div className="adm-field">
            <label htmlFor="v-stock">Stock</label>
            <input className="adm-input" id="v-stock" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Unlimited" />
            <span className="hint">How many exist. Blank = print to order.</span>
          </div>
        </div>
        <div className="adm-actions">
          <button className="adm-btn primary" type="submit" disabled={pending || !label.trim()}>
            {pending ? "Adding…" : "Add size"}
          </button>
        </div>
        <Msg r={r} />
      </form>
    </div>
  );
}
