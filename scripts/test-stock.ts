/**
 * Stock + order state against a fresh in-memory PGlite (the real migrations).
 *   npx tsx scripts/test-stock.ts
 * No network, no Stripe. Exits non-zero on the first failed check.
 */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { connectPglite, type Db } from "../src/db";
import { drops, orders, products, variants } from "../src/db/schema";
import { dropPhase, getCurrentDrop } from "../src/lib/shop/catalog";
import { attachSession, completeOrder, createPendingOrder, onceForEvent, releaseOrder, ShopError } from "../src/lib/shop/orders";
import { applicationFeeCents, STATEMENT_DESCRIPTOR } from "../src/lib/shop/stripe";

let passed = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

async function seed(db: Db, stock: number | null, opts: { startsAt?: Date | null; status?: "live" | "closed" | "draft" } = {}) {
  const [d] = await db
    .insert(drops)
    .values({ slug: `d-${Math.random()}`, title: "T", status: opts.status ?? "live", startsAt: opts.startsAt ?? null, shippingCents: 600 })
    .returning();
  const [p] = await db
    .insert(products)
    .values({ dropId: d.id, slug: `p-${Math.random()}`, name: "Hat", priceCents: 3800 })
    .returning();
  const [v] = await db
    .insert(variants)
    .values({ productId: p.id, label: "One size", sku: `S-${Math.random()}`, stockQty: stock })
    .returning();
  return { drop: d, product: p, variant: v };
}

async function counts(db: Db, id: number) {
  const [v] = await db.select().from(variants).where(eq(variants.id, id));
  return { reserved: v.reserved, sold: v.sold };
}

async function errCode(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof ShopError ? e.code : `other:${(e as Error).message}`;
  }
}

async function main() {
  const db = await connectPglite(); // in-memory, migrated

  await check("statement descriptor fits Stripe's 22 chars", () => {
    assert.ok(STATEMENT_DESCRIPTOR.length <= 22, STATEMENT_DESCRIPTOR);
  });
  await check("application fee = 1% + 2.9% + 30¢", () => {
    assert.equal(applicationFeeCents(4400), Math.round(4400 * 0.039) + 30);
    assert.equal(applicationFeeCents(0), 0);
  });

  await check("50 parallel buyers for 50 hats all get one; the 51st is sold out", async () => {
    const { variant } = await seed(db, 50);
    const results = await Promise.all(
      Array.from({ length: 60 }, () => errCode(createPendingOrder(db, { variantId: variant.id, qty: 1 }))),
    );
    assert.equal(results.filter((r) => r === "ok").length, 50);
    assert.equal(results.filter((r) => r === "SOLD_OUT").length, 10);
    assert.deepEqual(await counts(db, variant.id), { reserved: 50, sold: 0 });
  });

  await check("mixed quantities never exceed stock", async () => {
    const { variant } = await seed(db, 12);
    const qtys = [5, 5, 5, 3, 2, 1, 4];
    const results = await Promise.all(qtys.map((qty) => errCode(createPendingOrder(db, { variantId: variant.id, qty }))));
    const won = qtys.filter((_, i) => results[i] === "ok").reduce((a, b) => a + b, 0);
    const c = await counts(db, variant.id);
    assert.ok(won <= 12, `won ${won}`);
    assert.equal(c.reserved, won);
  });

  await check("expired checkout releases its units; a second release is a no-op", async () => {
    const { variant } = await seed(db, 2);
    const o = await createPendingOrder(db, { variantId: variant.id, qty: 2 });
    assert.equal(await errCode(createPendingOrder(db, { variantId: variant.id, qty: 1 })), "SOLD_OUT");
    await attachSession(db, o.orderId, "cs_test_expire");
    assert.equal(await releaseOrder(db, { sessionId: "cs_test_expire" }), true);
    assert.equal(await releaseOrder(db, { sessionId: "cs_test_expire" }), false);
    assert.deepEqual(await counts(db, variant.id), { reserved: 0, sold: 0 });
    assert.equal(await errCode(createPendingOrder(db, { variantId: variant.id, qty: 1 })), "ok");
  });

  await check("completed checkout moves reserved → sold once, even if Stripe re-sends the event", async () => {
    const { variant } = await seed(db, 5);
    const o = await createPendingOrder(db, { variantId: variant.id, qty: 3 });
    await attachSession(db, o.orderId, "cs_test_paid");
    const details = { email: "buyer@example.com", name: "A Buyer", shipping: null, paymentIntentId: "pi_1", totalCents: o.totalCents };
    const ev = { id: "evt_paid_1", type: "checkout.session.completed" };
    const first = await onceForEvent(db, ev, (tx) => completeOrder(tx, "cs_test_paid", details));
    const again = await onceForEvent(db, ev, (tx) => completeOrder(tx, "cs_test_paid", details));
    assert.equal(first.handled && first.result, o.orderId);
    assert.equal(again.handled, false);
    assert.deepEqual(await counts(db, variant.id), { reserved: 0, sold: 3 });
    const [row] = await db.select().from(orders).where(eq(orders.id, o.orderId));
    assert.equal(row.status, "paid");
    assert.equal(row.number, `HOT-${1000 + o.orderId}`);
    assert.equal(row.totalCents, 3 * 3800 + 600);
    // A late expiry for a paid order changes nothing.
    assert.equal(await releaseOrder(db, { sessionId: "cs_test_paid" }), false);
    assert.deepEqual(await counts(db, variant.id), { reserved: 0, sold: 3 });
  });

  await check("unlimited stock (null) always reserves", async () => {
    const { variant } = await seed(db, null);
    assert.equal(await errCode(createPendingOrder(db, { variantId: variant.id, qty: 5 })), "ok");
  });

  await check("the database refuses an oversell even without the guarded UPDATE", async () => {
    const { variant } = await seed(db, 1);
    await assert.rejects(db.update(variants).set({ reserved: 2 }).where(eq(variants.id, variant.id)));
  });

  await check("upcoming, closed and draft drops refuse checkout; bad qty is refused", async () => {
    const up = await seed(db, 5, { startsAt: new Date(Date.now() + 3600_000) });
    assert.equal(await errCode(createPendingOrder(db, { variantId: up.variant.id, qty: 1 })), "NOT_OPEN");
    const closed = await seed(db, 5, { status: "closed" });
    assert.equal(await errCode(createPendingOrder(db, { variantId: closed.variant.id, qty: 1 })), "NOT_OPEN");
    const draft = await seed(db, 5, { status: "draft" });
    assert.equal(await errCode(createPendingOrder(db, { variantId: draft.variant.id, qty: 1 })), "NOT_FOUND");
    assert.equal(await errCode(createPendingOrder(db, { variantId: up.variant.id, qty: 6 })), "BAD_QTY");
    assert.deepEqual(await counts(db, up.variant.id), { reserved: 0, sold: 0 });
  });

  await check("dropPhase reads status and window", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    assert.equal(dropPhase({ status: "live", startsAt: null, endsAt: null }, now), "open");
    assert.equal(dropPhase({ status: "live", startsAt: new Date("2026-11-21T00:00:00Z"), endsAt: null }, now), "upcoming");
    assert.equal(dropPhase({ status: "live", startsAt: null, endsAt: new Date("2026-11-19T00:00:00Z") }, now), "ended");
    assert.equal(dropPhase({ status: "closed", startsAt: null, endsAt: null }, now), "ended");
  });

  await check("/shop shows a live drop over a closed one, never a draft", async () => {
    const fresh = await connectPglite();
    await seed(fresh, 5, { status: "draft" });
    assert.equal(await getCurrentDrop(fresh), null);
    const closed = await seed(fresh, 5, { status: "closed" });
    assert.equal((await getCurrentDrop(fresh))?.id, closed.drop.id);
    const live = await seed(fresh, 5, { status: "live" });
    assert.equal((await getCurrentDrop(fresh))?.id, live.drop.id);
  });

  console.log(`\n${passed} checks passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
