"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/admin/auth";
import { createDrop, updateDrop } from "@/lib/admin/actions/catalog";
import { pacificInputToIso } from "@/lib/admin/format";
import Msg from "./Msg";

export type DropValues = {
  title: string;
  slug: string;
  blurb: string;
  status: "draft" | "live" | "closed";
  startsAt: string; // Pacific datetime-local
  endsAt: string;
  shipping: string; // dollars
  shipsBy: string; // YYYY-MM-DD or ""
  policy: string;
};

const EMPTY: DropValues = { title: "", slug: "", blurb: "", status: "draft", startsAt: "", endsAt: "", shipping: "8", shipsBy: "", policy: "" };

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function dollarsToCents(s: string): number {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export default function DropForm({ id, initial }: { id?: number; initial?: DropValues }) {
  const router = useRouter();
  const [v, setV] = useState<DropValues>(initial ?? EMPTY);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [r, setR] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof DropValues>(k: K, val: DropValues[K]) => setV((p) => ({ ...p, [k]: val }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const shippingCents = dollarsToCents(v.shipping || "0");
    if (Number.isNaN(shippingCents)) return setR({ ok: false, error: "Shipping should be a dollar amount, like 8 or 8.50" });
    const input = {
      title: v.title,
      slug: v.slug,
      blurb: v.blurb,
      status: v.status,
      startsAt: pacificInputToIso(v.startsAt),
      endsAt: pacificInputToIso(v.endsAt),
      shippingCents,
      shipsBy: v.shipsBy,
      policy: v.policy,
    };
    start(async () => {
      if (id) {
        setR(await updateDrop(id, input));
        router.refresh();
        return;
      }
      const res = await createDrop(input);
      if (res.ok && res.id) router.push(`/admin/drops/${res.id}`);
      else setR(res);
    });
  }

  return (
    <form className="adm-form" onSubmit={submit}>
      <div className="adm-row">
        <div className="adm-field">
          <label htmlFor="d-title">Title</label>
          <input
            className="adm-input"
            id="d-title"
            required
            value={v.title}
            placeholder="Drop 01 — Corduroy Hat"
            onChange={(e) => {
              set("title", e.target.value);
              if (!slugTouched) set("slug", slugify(e.target.value));
            }}
          />
        </div>
        <div className="adm-field">
          <label htmlFor="d-slug">Slug</label>
          <input
            className="adm-input"
            id="d-slug"
            required
            value={v.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value);
            }}
          />
          <span className="hint">Internal name. Lowercase, dashes.</span>
        </div>
      </div>
      <div className="adm-field">
        <label htmlFor="d-blurb">Blurb</label>
        <textarea id="d-blurb" value={v.blurb} maxLength={1000} onChange={(e) => set("blurb", e.target.value)} placeholder="One or two lines at the top of /shop." />
      </div>
      <div className="adm-row three">
        <div className="adm-field">
          <label htmlFor="d-status">Status</label>
          <select id="d-status" value={v.status} onChange={(e) => set("status", e.target.value as DropValues["status"])}>
            <option value="draft">Draft (hidden)</option>
            <option value="live">Live (on /shop)</option>
            <option value="closed">Closed (shown, not selling)</option>
          </select>
        </div>
        <div className="adm-field">
          <label htmlFor="d-start">Opens (Pacific)</label>
          <input className="adm-input" id="d-start" type="datetime-local" value={v.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
          <span className="hint">Blank = open as soon as it&rsquo;s live. A future time shows a countdown.</span>
        </div>
        <div className="adm-field">
          <label htmlFor="d-end">Closes (Pacific)</label>
          <input className="adm-input" id="d-end" type="datetime-local" value={v.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
          <span className="hint">Blank = sells until sold out.</span>
        </div>
      </div>
      <div className="adm-row">
        <div className="adm-field">
          <label htmlFor="d-ship">Shipping per order (US)</label>
          <div className="adm-prefix">
            <span>$</span>
            <input className="adm-input" id="d-ship" inputMode="decimal" value={v.shipping} onFocus={(e) => e.currentTarget.select()} onChange={(e) => set("shipping", e.target.value)} />
          </div>
          <span className="hint">Flat rate, whatever&rsquo;s in the order. 0 = free.</span>
        </div>
        <div className="adm-field">
          <label htmlFor="d-shipsby">Ships by</label>
          <input className="adm-input" id="d-shipsby" type="date" value={v.shipsBy} onChange={(e) => set("shipsBy", e.target.value)} />
          <span className="hint">Shown on the product page and in the receipt. Blank = no date promised.</span>
        </div>
      </div>
      <div className="adm-field">
        <label htmlFor="d-policy">Policy line</label>
        <textarea
          id="d-policy"
          value={v.policy}
          maxLength={500}
          onChange={(e) => set("policy", e.target.value)}
          placeholder="Returns and exchanges, who ships it. Shown under Buy on every product in this drop."
        />
      </div>
      <div className="adm-actions">
        <button className="adm-btn primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : id ? "Save drop" : "Create drop"}
        </button>
      </div>
      <Msg r={r} />
    </form>
  );
}
