import Link from "next/link";
import { getDb } from "@/db";
import { listOrders, orderCounts, ORDER_FILTERS, parseOrderFilter } from "@/lib/admin/queries";
import { fmtDate, STATUS_LABEL } from "@/lib/admin/format";
import { formatCents } from "@/lib/shop/catalog";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const f = parseOrderFilter(sp.f);
  const q = (sp.q ?? "").slice(0, 100);
  const db = await getDb();
  const [rows, counts] = await Promise.all([listOrders(db, f, q), orderCounts(db)]);
  const countFor: Record<string, number | undefined> = {
    "to-ship": counts.toShip,
    shipped: counts.shipped,
    refunded: counts.refunded,
  };

  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Orders</h1>
          <p>
            {f === "to-ship"
              ? "Paid and waiting to ship, oldest first. Open one to mark it shipped."
              : "Paid orders. Unfinished checkouts aren't listed."}
          </p>
        </div>
      </header>

      <div className="adm-toolbar">
        <nav className="adm-tabs" aria-label="Filter orders">
          {ORDER_FILTERS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/orders?f=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={t.key === f ? "on" : undefined}
            >
              {t.label}
              {countFor[t.key] !== undefined && <span>{countFor[t.key]}</span>}
            </Link>
          ))}
        </nav>
        <form action="/admin/orders" style={{ display: "flex", gap: 8 }}>
          <input type="hidden" name="f" value={f} />
          <input className="adm-input" name="q" defaultValue={q} placeholder="Order #, name or email" aria-label="Search orders" style={{ width: 230 }} />
          <button className="adm-btn ghost" type="submit">
            Search
          </button>
        </form>
      </div>

      <section className="adm-card">
        {rows.length === 0 ? (
          <p className="adm-empty">{q ? `No orders match “${q}”.` : f === "to-ship" ? "Nothing to ship." : "No orders here yet."}</p>
        ) : (
          <div className="adm-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Buyer</th>
                  <th>Items</th>
                  <th>Ship to</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link className="row-link" href={`/admin/orders/${o.id}`}>
                        {o.number}
                      </Link>
                      <div className="adm-sub">{fmtDate(o.paidAt ?? o.createdAt)}</div>
                    </td>
                    <td>
                      {o.name ?? "—"}
                      <div className="adm-sub">{o.email}</div>
                    </td>
                    <td>
                      {o.items.map((it) => (
                        <div key={it.id}>
                          {it.qty} × {it.productName} <span className="adm-sub">· {it.variantLabel}</span>
                        </div>
                      ))}
                    </td>
                    <td className="adm-sub">
                      {[o.shipping?.city, o.shipping?.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td>
                      <span className={`adm-pill ${o.status}`}>{STATUS_LABEL[o.status]}</span>
                    </td>
                    <td className="num">{formatCents(o.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
