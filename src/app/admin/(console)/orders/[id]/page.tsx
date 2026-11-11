import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getOrder } from "@/lib/admin/queries";
import { fmtDate, STATUS_LABEL } from "@/lib/admin/format";
import { formatCents } from "@/lib/shop/catalog";
import { trackingUrl } from "@/lib/shop/notify";
import { connectedAccountId } from "@/lib/shop/stripe";
import { OrderNote, RefundPanel, ShipPanel } from "@/components/admin/OrderActions";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const data = await getOrder(await getDb(), id);
  if (!data) notFound();
  const { order: o, items, drop } = data;
  const a = o.shipping;
  const addr = a
    ? [a.name ?? o.name, a.line1, a.line2, [a.city, a.state, a.postalCode].filter(Boolean).join(", "), a.country !== "US" ? a.country : null].filter(
        (l): l is string => Boolean(l && l.trim()),
      )
    : [];
  const track = trackingUrl(o.trackingCarrier, o.trackingNumber);
  const canAct = o.status === "paid" || o.status === "fulfilled";

  return (
    <>
      <p className="adm-crumb">
        <Link href="/admin/orders">Orders</Link> / {o.number}
      </p>
      <header className="adm-head">
        <div>
          <h1>{o.number}</h1>
          <p>
            <span className={`adm-pill ${o.status}`}>{STATUS_LABEL[o.status]}</span> · {fmtDate(o.paidAt ?? o.createdAt)}
            {drop && (
              <>
                {" "}
                · <Link href={`/admin/drops/${drop.id}`}>{drop.title}</Link>
              </>
            )}
          </p>
        </div>
      </header>

      <div className="adm-grid2">
        <div>
          <section className="adm-card">
            <h2>Items</h2>
            <table className="adm-table">
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <strong>{it.productName}</strong> · {it.variantLabel}
                      <div className="adm-sub">SKU {it.sku}</div>
                    </td>
                    <td className="num">× {it.qty}</td>
                    <td className="num">{formatCents(it.unitPriceCents * it.qty)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} className="adm-sub">
                    Shipping
                  </td>
                  <td className="num">{o.shippingCents ? formatCents(o.shippingCents) : "Free"}</td>
                </tr>
                <tr>
                  <td colSpan={2}>
                    <strong>Total</strong>
                  </td>
                  <td className="num">
                    <strong>{formatCents(o.totalCents)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {canAct && (
            <ShipPanel
              orderId={o.id}
              shipped={o.status === "fulfilled"}
              carrier={o.trackingCarrier}
              trackingNumber={o.trackingNumber}
              hasEmail={Boolean(o.email)}
            />
          )}

          <OrderNote orderId={o.id} note={o.adminNote} />
        </div>

        <div>
          <section className="adm-card">
            <h2>Ship to</h2>
            {addr.length ? (
              <address style={{ fontStyle: "normal", lineHeight: 1.55 }}>
                {addr.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </address>
            ) : (
              <p className="adm-empty">No address on this order.</p>
            )}
          </section>

          <section className="adm-card">
            <h2>Details</h2>
            <dl className="adm-dl">
              <dt>Buyer</dt>
              <dd>{o.name ?? "—"}</dd>
              <dt>Email</dt>
              <dd>{o.email ? <a href={`mailto:${o.email}`}>{o.email}</a> : "—"}</dd>
              <dt>Paid</dt>
              <dd>{fmtDate(o.paidAt)}</dd>
              <dt>Shipped</dt>
              <dd>{fmtDate(o.fulfilledAt)}</dd>
              <dt>Tracking</dt>
              <dd>
                {o.trackingNumber ? (
                  <>
                    {o.trackingCarrier}{" "}
                    {track ? (
                      <a href={track} target="_blank" rel="noreferrer">
                        {o.trackingNumber}
                      </a>
                    ) : (
                      o.trackingNumber
                    )}
                  </>
                ) : (
                  "—"
                )}
              </dd>
              <dt>Payment</dt>
              {/* The charge lives on TEGO's platform Stripe account, so this id is for TEGO support. */}
              <dd className="adm-sub">{o.paymentIntentId ?? "—"}</dd>
            </dl>
          </section>

          {canAct && o.paymentIntentId && connectedAccountId() && <RefundPanel orderId={o.id} total={formatCents(o.totalCents)} />}
        </div>
      </div>
    </>
  );
}
