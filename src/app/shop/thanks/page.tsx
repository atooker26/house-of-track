import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db";
import { formatCents } from "@/lib/shop/catalog";
import { getOrderView } from "@/lib/shop/orders";
import { STATEMENT_DESCRIPTOR } from "@/lib/shop/stripe";

export const metadata: Metadata = {
  title: "Thanks — House of Track",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = { searchParams: Promise<{ session_id?: string | string[] }> };

export default async function ThanksPage({ searchParams }: Props) {
  await connection();
  const raw = (await searchParams).session_id;
  const sessionId = typeof raw === "string" && /^cs_[A-Za-z0-9_]+$/.test(raw) ? raw : null;
  const view = sessionId ? await getOrderView(await getDb(), { sessionId }) : null;

  if (!view) {
    return (
      <section className="section">
        <div className="wrap shop-thanks">
          <h1 className="shop-product-name">We couldn&apos;t find that order</h1>
          <p>If you paid, your receipt email has the details.</p>
          <Link href="/shop" className="btn btn-primary">
            Back to the shop
          </Link>
        </div>
      </section>
    );
  }

  const { order, items } = view;
  // The webhook can land a second or two after Stripe sends the buyer back.
  const confirmed = order.status === "paid" || order.status === "fulfilled";

  return (
    <section className="section">
      <div className="wrap shop-thanks">
        <p className="eyebrow coral">Order {order.number}</p>
        <h1 className="shop-product-name">{confirmed ? "You're in. Thank you." : "Payment received, confirming…"}</h1>
        <p>
          {confirmed
            ? "A receipt is on its way to your inbox. We'll email again when it ships."
            : "Your order is being confirmed. Refresh in a moment; your receipt email follows either way."}
        </p>
        <table className="shop-thanks-table">
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>
                  {it.productName} — {it.variantLabel} × {it.qty}
                </td>
                <td>{formatCents(it.unitPriceCents * it.qty)}</td>
              </tr>
            ))}
            <tr>
              <td>Shipping</td>
              <td>{order.shippingCents ? formatCents(order.shippingCents) : "Free"}</td>
            </tr>
            <tr className="shop-thanks-total">
              <td>Total</td>
              <td>{formatCents(order.totalCents)}</td>
            </tr>
          </tbody>
        </table>
        <p className="shop-product-ship">Your card statement will read {STATEMENT_DESCRIPTOR}.</p>
        <Link href="/shop" className="btn btn-outline">
          Back to the shop
        </Link>
      </div>
    </section>
  );
}
