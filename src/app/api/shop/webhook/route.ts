import { after, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getDb } from "@/db";
import { notifyPaidOrder } from "@/lib/shop/notify";
import { completeOrder, onceForEvent, releaseOrder } from "@/lib/shop/orders";
import { getStripe } from "@/lib/shop/stripe";

export const runtime = "nodejs";

/**
 * Stripe → House of Track. Register this URL on TEGO's platform account with
 * events checkout.session.completed and checkout.session.expired.
 *
 * TEGO's platform account also serves other sites (LB Mile, Pyramid), and a
 * platform endpoint receives every one of its Checkout events, so anything
 * without metadata.site = "house-of-track" is acknowledged and ignored.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.expired") {
    return NextResponse.json({ received: true });
  }
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.metadata?.site !== "house-of-track") return NextResponse.json({ received: true, ignored: true });

  const db = await getDb();

  if (event.type === "checkout.session.expired") {
    await onceForEvent(db, event, (tx) => releaseOrder(tx, { sessionId: session.id }));
    return NextResponse.json({ received: true });
  }

  // completed — paid for card payments. (Delayed methods aren't enabled.)
  if (session.payment_status !== "paid") return NextResponse.json({ received: true, unpaid: true });

  const ship = session.collected_information?.shipping_details ?? null;
  const addr = ship?.address ?? session.customer_details?.address ?? null;
  const outcome = await onceForEvent(db, event, (tx) =>
    completeOrder(tx, session.id, {
      email: session.customer_details?.email?.toLowerCase() ?? null,
      name: ship?.name ?? session.customer_details?.name ?? null,
      shipping: addr
        ? {
            name: ship?.name ?? null,
            line1: addr.line1,
            line2: addr.line2,
            city: addr.city,
            state: addr.state,
            postalCode: addr.postal_code,
            country: addr.country,
          }
        : null,
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
      totalCents: session.amount_total ?? null,
    }),
  );

  if (outcome.handled && outcome.result !== null) {
    const orderId = outcome.result;
    after(() => notifyPaidOrder(db, orderId));
  } else if (outcome.handled) {
    // Paid, but the order wasn't pending (already cancelled). Shouldn't happen —
    // Stripe can't complete an expired session — so make it loud.
    console.error(`[shop] session ${session.id} paid but its order was not pending`);
  }
  return NextResponse.json({ received: true });
}
