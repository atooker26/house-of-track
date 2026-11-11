import Link from "next/link";
import { getDb } from "@/db";
import { overview } from "@/lib/admin/queries";
import { fmtDate, STATUS_LABEL } from "@/lib/admin/format";
import { formatCents } from "@/lib/shop/catalog";
import { checkoutOpen } from "@/lib/shop/stripe";
import { tegoConfigured } from "@/lib/shop/tego";

export default async function Overview() {
  const db = await getDb();
  const o = await overview(db);
  const setup = [
    !checkoutOpen() && "Checkout is off until House of Track finishes Stripe in TEGO (Documents → Payments).",
    !tegoConfigured() && "Receipts, order alerts and shipped emails are off until TEGO_API_KEY is set.",
    !process.env.STRIPE_WEBHOOK_SECRET && "Paid orders won't be recorded until the Stripe webhook secret is set.",
  ].filter(Boolean) as string[];

  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Overview</h1>
          <p>Sales, the shipping queue, and how the current drop is selling.</p>
        </div>
        <Link href="/admin/drops/new" className="adm-btn primary">
          New drop
        </Link>
      </header>

      {setup.length > 0 && (
        <div className="adm-card" style={{ background: "#FFF8E6", borderColor: "#F0DDA8" }}>
          <h2>Before the first sale</h2>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {setup.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="adm-stats">
        <Link href="/admin/orders" className={`adm-stat${o.counts.toShip ? " hot" : ""}`}>
          <small>To ship</small>
          <b>{o.counts.toShip}</b>
          <span>{o.counts.toShip ? "Oldest first in Orders" : "All caught up"}</span>
        </Link>
        <div className="adm-stat">
          <small>Sales, 30 days</small>
          <b>{formatCents(o.last30.revenueCents)}</b>
          <span>
            {o.last30.orders} order{o.last30.orders === 1 ? "" : "s"}
          </span>
        </div>
        <div className="adm-stat">
          <small>Sales, all time</small>
          <b>{formatCents(o.totals.revenueCents)}</b>
          <span>
            {o.totals.orders} orders · {o.totals.units} units
          </span>
        </div>
        <Link href="/admin/orders?f=shipped" className="adm-stat">
          <small>Shipped</small>
          <b>{o.counts.shipped}</b>
          <span>{o.counts.refunded ? `${o.counts.refunded} refunded` : "No refunds"}</span>
        </Link>
      </div>

      <div className="adm-grid2">
        <section className="adm-card">
          <div className="adm-card-head">
            <h2>{o.current ? `Live: ${o.current.title}` : "No live drop"}</h2>
            {o.current && (
              <Link href={`/admin/drops/${o.current.id}`} className="adm-btn ghost sm">
                Edit drop
              </Link>
            )}
          </div>
          {!o.current ? (
            <p className="adm-empty">
              Nothing is selling.{" "}
              {o.draftCount ? (
                <Link href="/admin/drops">
                  {o.draftCount} draft{o.draftCount === 1 ? "" : "s"} waiting
                </Link>
              ) : (
                <Link href="/admin/drops/new">Set up a drop</Link>
              )}
              .
            </p>
          ) : (
            <>
              <p className="adm-sub" style={{ marginTop: -6 }}>
                <span className={`adm-pill ${o.current.phase}`}>{STATUS_LABEL[o.current.phase]}</span>{" "}
                {o.current.startsAt && o.current.phase === "upcoming" && <>Opens {fmtDate(o.current.startsAt)} · </>}
                {o.current.orders} orders · {formatCents(o.current.revenueCents)}
              </p>
              <div className="adm-scroll">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="num">Sold</th>
                      <th className="num">Left</th>
                      <th style={{ width: "30%" }}>Sell-through</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.current.products.flatMap((p) =>
                      p.variants.map((v) => {
                        const pct = v.stockQty ? Math.round((v.sold / v.stockQty) * 100) : null;
                        return (
                          <tr key={v.id}>
                            <td>
                              {p.name} <span className="adm-sub">· {v.label}</span>
                            </td>
                            <td className="num">{v.sold}</td>
                            <td className="num">
                              {v.available === null ? "∞" : v.available}
                              {v.reserved > 0 && <span className="adm-sub"> (+{v.reserved} held)</span>}
                            </td>
                            <td>
                              {pct === null ? (
                                <span className="adm-sub">Unlimited</span>
                              ) : (
                                <div className="adm-bar" title={`${pct}%`}>
                                  <i style={{ width: `${pct}%` }} />
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      }),
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section className="adm-card">
          <div className="adm-card-head">
            <h2>Latest orders</h2>
            <Link href="/admin/orders?f=all" className="adm-btn ghost sm">
              All orders
            </Link>
          </div>
          {o.recent.length === 0 ? (
            <p className="adm-empty">No orders yet.</p>
          ) : (
            <table className="adm-table">
              <tbody>
                {o.recent.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link className="row-link" href={`/admin/orders/${r.id}`}>
                        {r.number}
                      </Link>
                      <div className="adm-sub">{r.name ?? r.email ?? "—"}</div>
                    </td>
                    <td>
                      <span className={`adm-pill ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td className="num">{formatCents(r.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
