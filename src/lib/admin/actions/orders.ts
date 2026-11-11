"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { orderItems, orders, variants } from "@/db/schema";
import { adminOrError, NOT_ALLOWED, type ActionResult } from "@/lib/admin/auth";
import { CARRIERS, sendShippedEmail } from "@/lib/shop/notify";
import { connectedAccountId, getStripe } from "@/lib/shop/stripe";

function refresh(orderId: number) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/orders/${orderId}`);
}

const shipSchema = z.object({
  orderId: z.number().int().positive(),
  carrier: z.enum(CARRIERS).nullable(),
  trackingNumber: z.string().trim().max(80),
  notify: z.boolean(),
});

/** Paid → shipped, with optional tracking, and (by default) the buyer's "shipped" email. */
export async function markShipped(input: z.input<typeof shipSchema>): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const p = shipSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the form" };
  const { orderId, carrier, trackingNumber, notify } = p.data;
  const db = await getDb();
  const updated = await db
    .update(orders)
    .set({
      status: "fulfilled",
      fulfilledAt: sql`coalesce(${orders.fulfilledAt}, now())`,
      trackingCarrier: trackingNumber ? carrier : null,
      trackingNumber: trackingNumber || null,
      updatedAt: new Date(),
    })
    // Fulfilled → fulfilled is allowed, so a typo'd tracking number can be fixed.
    .where(and(eq(orders.id, orderId), sql`${orders.status} in ('paid', 'fulfilled')`))
    .returning({ id: orders.id });
  if (!updated.length) return { ok: false, error: "Only paid orders can be marked shipped." };
  refresh(orderId);

  if (!notify) return { ok: true, message: "Marked shipped. No email sent." };
  try {
    const r = await sendShippedEmail(db, orderId);
    if (r === "no-tego") return { ok: true, message: "Marked shipped. Email is off until TEGO_API_KEY is set." };
    if (r === "no-email") return { ok: true, message: "Marked shipped. The order has no email to notify." };
    return { ok: true, message: "Marked shipped and emailed the buyer." };
  } catch (err) {
    console.error(`[admin] shipped email for order ${orderId} failed:`, err);
    return { ok: true, message: "Marked shipped, but the email didn't send. Try 'Resend' in a minute." };
  }
}

/** Back to the shipping queue (shipped by mistake). Tracking is kept in case it's still right. */
export async function markUnshipped(orderId: number): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const db = await getDb();
  const updated = await db
    .update(orders)
    .set({ status: "paid", fulfilledAt: null, updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, "fulfilled")))
    .returning({ id: orders.id });
  if (!updated.length) return { ok: false, error: "That order isn't marked shipped." };
  refresh(orderId);
  return { ok: true, message: "Back in the shipping queue." };
}

export async function saveNote(orderId: number, note: string): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const db = await getDb();
  await db
    .update(orders)
    .set({ adminNote: note.slice(0, 4000), updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  refresh(orderId);
  return { ok: true, message: "Note saved." };
}

/**
 * Full refund. The charge was a destination charge on TEGO's platform account, so
 * the refund pulls the money back from House of Track's connected account
 * (reverse_transfer) and returns TEGO's fee too (refund_application_fee): the
 * buyer gets everything back and nobody is left out of pocket but the shop's
 * card cost. `restock` puts the units back on sale.
 */
export async function refundOrder(orderId: number, restock: boolean): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const db = await getDb();
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) return { ok: false, error: "Order not found." };
  if (o.status !== "paid" && o.status !== "fulfilled") return { ok: false, error: "Only paid orders can be refunded." };
  if (!o.paymentIntentId) return { ok: false, error: "This order has no Stripe payment to refund." };
  if (!connectedAccountId()) return { ok: false, error: "Stripe isn't connected, so refunds are off." };

  try {
    await getStripe().refunds.create(
      { payment_intent: o.paymentIntentId, reverse_transfer: true, refund_application_fee: true },
      // A double click, or a retry after a timeout, can't refund twice.
      { idempotencyKey: `hot-refund-${o.number}` },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Already refunded in Stripe (e.g. from the dashboard): record it here too.
    if (!/already been refunded/i.test(msg)) {
      console.error(`[admin] refund ${o.number} failed:`, msg);
      return { ok: false, error: `Stripe refused the refund: ${msg}` };
    }
  }

  await db.transaction(async (tx) => {
    const done = await tx
      .update(orders)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), sql`${orders.status} in ('paid', 'fulfilled')`))
      .returning({ id: orders.id });
    if (!done.length || !restock) return;
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const it of items) {
      await tx
        .update(variants)
        .set({ sold: sql`greatest(${variants.sold} - ${it.qty}, 0)` })
        .where(eq(variants.id, it.variantId));
    }
  });
  refresh(orderId);
  revalidatePath("/shop", "layout");
  return { ok: true, message: restock ? "Refunded in full and put back in stock." : "Refunded in full." };
}

export async function resendShipped(orderId: number): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const db = await getDb();
  try {
    const r = await sendShippedEmail(db, orderId);
    if (r === "no-tego") return { ok: false, error: "Email is off until TEGO_API_KEY is set." };
    if (r === "no-email") return { ok: false, error: "The order has no email address." };
    return { ok: true, message: "Shipped email sent (TEGO skips it if this exact one already went)." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}
