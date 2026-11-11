import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { drops, orderItems, orders, processedStripeEvents, products, variants, type ShippingAddress } from "@/db/schema";
import { dropPhase } from "./catalog";

/**
 * Stock and order state. Every function takes the db, so the same code runs on
 * Supabase in production and on in-memory PGlite in scripts/test-stock.ts.
 *
 *   checkout   → createPendingOrder: reserve (atomic) + pending order
 *   session.expired / Stripe failure → releaseOrder: pending → cancelled, reserved back
 *   session.completed → completeOrder: pending → paid, reserved → sold
 *
 * The reserve is one conditional UPDATE, so two buyers racing for the last hat
 * can't both win; the variants_no_oversell CHECK is the backstop under it.
 */

export const MAX_QTY = 5;

export class ShopError extends Error {
  constructor(
    public code: "NOT_FOUND" | "NOT_OPEN" | "SOLD_OUT" | "BAD_QTY",
    message: string,
  ) {
    super(message);
    this.name = "ShopError";
  }
}

export type PendingOrder = {
  orderId: number;
  number: string;
  dropId: number;
  productName: string;
  productSlug: string;
  productImage: string | null;
  variantLabel: string;
  sku: string;
  unitPriceCents: number;
  qty: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
};

export function formatOrderNumber(id: number): string {
  return `HOT-${1000 + id}`;
}

export async function createPendingOrder(
  db: Db,
  input: { variantId: number; qty: number },
  now = new Date(),
): Promise<PendingOrder> {
  const { variantId, qty } = input;
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
    throw new ShopError("BAD_QTY", `Pick between 1 and ${MAX_QTY}.`);
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ v: variants, p: products, d: drops })
      .from(variants)
      .innerJoin(products, eq(products.id, variants.productId))
      .innerJoin(drops, eq(drops.id, products.dropId))
      .where(eq(variants.id, variantId));
    if (!row || row.p.active !== 1 || row.d.status === "draft") {
      throw new ShopError("NOT_FOUND", "That item isn't in the shop.");
    }
    const phase = dropPhase(row.d, now);
    if (phase !== "open") {
      throw new ShopError("NOT_OPEN", phase === "upcoming" ? "This drop hasn't opened yet." : "This drop has ended.");
    }

    const reserved = await tx
      .update(variants)
      .set({ reserved: sql`${variants.reserved} + ${qty}` })
      .where(
        and(
          eq(variants.id, variantId),
          sql`(${variants.stockQty} is null or ${variants.stockQty} - ${variants.sold} - ${variants.reserved} >= ${qty})`,
        ),
      )
      .returning({ id: variants.id });
    if (reserved.length === 0) {
      throw new ShopError("SOLD_OUT", qty > 1 ? "Not enough left for that many." : "Sold out.");
    }

    const subtotalCents = row.p.priceCents * qty;
    const shippingCents = row.d.shippingCents;
    const totalCents = subtotalCents + shippingCents;

    // Number comes from the id, so insert with a throwaway unique value first.
    const [o] = await tx
      .insert(orders)
      .values({
        number: `tmp-${randomUUID()}`,
        status: "pending",
        dropId: row.d.id,
        subtotalCents,
        shippingCents,
        totalCents,
      })
      .returning({ id: orders.id });
    const number = formatOrderNumber(o.id);
    await tx.update(orders).set({ number }).where(eq(orders.id, o.id));

    await tx.insert(orderItems).values({
      orderId: o.id,
      variantId,
      productName: row.p.name,
      variantLabel: row.v.label,
      sku: row.v.sku,
      unitPriceCents: row.p.priceCents,
      qty,
    });

    return {
      orderId: o.id,
      number,
      dropId: row.d.id,
      productName: row.p.name,
      productSlug: row.p.slug,
      productImage: row.p.images[0] ?? null,
      variantLabel: row.v.label,
      sku: row.v.sku,
      unitPriceCents: row.p.priceCents,
      qty,
      subtotalCents,
      shippingCents,
      totalCents,
    };
  });
}

export async function attachSession(db: Db, orderId: number, sessionId: string): Promise<void> {
  await db
    .update(orders)
    .set({ stripeSessionId: sessionId, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function moveItems(tx: Tx, orderId: number, mode: "release" | "sell") {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const it of items) {
    await tx
      .update(variants)
      .set(
        mode === "release"
          ? { reserved: sql`${variants.reserved} - ${it.qty}` }
          : { reserved: sql`${variants.reserved} - ${it.qty}`, sold: sql`${variants.sold} + ${it.qty}` },
      )
      .where(eq(variants.id, it.variantId));
  }
}

/** Pending → cancelled and its units back on the shelf. A no-op for any other status. */
export async function releaseOrder(db: Db | Tx, where: { orderId: number } | { sessionId: string }): Promise<boolean> {
  const run = async (tx: Tx) => {
    const cond = "orderId" in where ? eq(orders.id, where.orderId) : eq(orders.stripeSessionId, where.sessionId);
    const [o] = await tx
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(cond, eq(orders.status, "pending")))
      .returning({ id: orders.id });
    if (!o) return false;
    await moveItems(tx, o.id, "release");
    return true;
  };
  // Inside another transaction this nests as a savepoint.
  return (db as Db).transaction(run);
}

export type PaidDetails = {
  email: string | null;
  name: string | null;
  shipping: ShippingAddress | null;
  paymentIntentId: string | null;
  totalCents: number | null;
};

/** Pending → paid and its units from reserved to sold. Returns the order id, or null if it wasn't pending. */
export async function completeOrder(db: Db | Tx, sessionId: string, details: PaidDetails): Promise<number | null> {
  const run = async (tx: Tx) => {
    const now = new Date();
    const [o] = await tx
      .update(orders)
      .set({
        status: "paid",
        email: details.email,
        name: details.name,
        shipping: details.shipping,
        paymentIntentId: details.paymentIntentId,
        ...(details.totalCents !== null ? { totalCents: details.totalCents } : {}),
        paidAt: now,
        updatedAt: now,
      })
      .where(and(eq(orders.stripeSessionId, sessionId), eq(orders.status, "pending")))
      .returning({ id: orders.id });
    if (!o) return null;
    await moveItems(tx, o.id, "sell");
    return o.id;
  };
  // Inside another transaction this nests as a savepoint.
  return (db as Db).transaction(run);
}

/**
 * Runs `fn` once per Stripe event id: the event row and fn's writes commit
 * together, so a retry after a crash re-runs cleanly and a duplicate is skipped.
 * Returns false when the event was already handled.
 */
export async function onceForEvent<T>(
  db: Db,
  event: { id: string; type: string },
  fn: (tx: Tx) => Promise<T>,
): Promise<{ handled: false } | { handled: true; result: T }> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(processedStripeEvents)
      .values({ eventId: event.id, type: event.type })
      .onConflictDoNothing()
      .returning({ id: processedStripeEvents.eventId });
    if (inserted.length === 0) return { handled: false as const };
    return { handled: true as const, result: await fn(tx) };
  });
}

export async function getOrderView(db: Db, where: { sessionId: string } | { orderId: number }) {
  const cond = "orderId" in where ? eq(orders.id, where.orderId) : eq(orders.stripeSessionId, where.sessionId);
  const [o] = await db.select().from(orders).where(cond);
  if (!o) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  return { order: o, items };
}
