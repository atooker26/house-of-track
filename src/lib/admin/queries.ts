import "server-only";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { admins, drops, orderItems, orders, products, variants } from "@/db/schema";
import { availableOf, dropPhase } from "@/lib/shop/catalog";

/** Orders that count as money in: paid and not yet shipped, or shipped. */
export const SOLD_STATUSES = ["paid", "fulfilled"] as const;

export type OrderFilter = "to-ship" | "shipped" | "refunded" | "all";

export const ORDER_FILTERS: { key: OrderFilter; label: string }[] = [
  { key: "to-ship", label: "To ship" },
  { key: "shipped", label: "Shipped" },
  { key: "refunded", label: "Refunded" },
  { key: "all", label: "All" },
];

export function parseOrderFilter(raw: string | string[] | undefined): OrderFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return ORDER_FILTERS.some((f) => f.key === v) ? (v as OrderFilter) : "to-ship";
}

/** Pending orders are abandoned or in-progress checkouts; "All" leaves them out too. */
function filterCondition(f: OrderFilter) {
  switch (f) {
    case "to-ship":
      return eq(orders.status, "paid");
    case "shipped":
      return eq(orders.status, "fulfilled");
    case "refunded":
      return inArray(orders.status, ["refunded", "cancelled"]);
    case "all":
      return inArray(orders.status, ["paid", "fulfilled", "refunded", "cancelled"]);
  }
}

export async function listOrders(db: Db, f: OrderFilter, q: string) {
  const conds = [filterCondition(f)];
  const term = q.trim();
  if (term) {
    const like = `%${term.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(
      sql`(${orders.number} ilike ${like} or ${orders.email} ilike ${like} or ${orders.name} ilike ${like})`,
    );
  }
  const rows = await db
    .select()
    .from(orders)
    .where(and(...conds))
    // To ship: oldest first, so the queue reads in the order it should be packed.
    .orderBy(f === "to-ship" ? asc(orders.paidAt) : desc(orders.createdAt))
    .limit(200);
  const items = rows.length
    ? await db
        .select()
        .from(orderItems)
        .where(
          inArray(
            orderItems.orderId,
            rows.map((r) => r.id),
          ),
        )
    : [];
  return rows.map((o) => ({ ...o, items: items.filter((it) => it.orderId === o.id) }));
}

export async function orderCounts(db: Db) {
  const rows = await db
    .select({ status: orders.status, n: sql<number>`count(*)::int` })
    .from(orders)
    .groupBy(orders.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
  return {
    toShip: by.paid ?? 0,
    shipped: by.fulfilled ?? 0,
    refunded: (by.refunded ?? 0) + (by.cancelled ?? 0),
  };
}

export async function getOrder(db: Db, id: number) {
  const [o] = await db.select().from(orders).where(eq(orders.id, id));
  if (!o) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  const [drop] = await db.select({ id: drops.id, title: drops.title }).from(drops).where(eq(drops.id, o.dropId));
  return { order: o, items, drop: drop ?? null };
}

export type VariantStock = {
  id: number;
  label: string;
  sku: string;
  stockQty: number | null;
  sold: number;
  reserved: number;
  available: number | null;
  sort: number;
};

export type AdminProduct = typeof products.$inferSelect & { variants: VariantStock[] };

export async function listDrops(db: Db) {
  const rows = await db.select().from(drops).orderBy(desc(drops.createdAt), desc(drops.id));
  const stats = await db
    .select({
      dropId: orders.dropId,
      orders: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
    })
    .from(orders)
    .where(inArray(orders.status, [...SOLD_STATUSES]))
    .groupBy(orders.dropId);
  const productCounts = await db
    .select({ dropId: products.dropId, n: sql<number>`count(*)::int` })
    .from(products)
    .groupBy(products.dropId);
  return rows.map((d) => ({
    ...d,
    phase: dropPhase(d),
    orders: stats.find((s) => s.dropId === d.id)?.orders ?? 0,
    revenueCents: stats.find((s) => s.dropId === d.id)?.revenue ?? 0,
    productCount: productCounts.find((p) => p.dropId === d.id)?.n ?? 0,
  }));
}

export async function getDrop(db: Db, id: number) {
  const [d] = await db.select().from(drops).where(eq(drops.id, id));
  if (!d) return null;
  return { drop: d, phase: dropPhase(d), products: await dropProducts(db, id) };
}

export async function dropProducts(db: Db, dropId: number): Promise<AdminProduct[]> {
  const prods = await db
    .select()
    .from(products)
    .where(eq(products.dropId, dropId))
    .orderBy(asc(products.sort), asc(products.id));
  if (!prods.length) return [];
  const vars = await db
    .select()
    .from(variants)
    .where(
      inArray(
        variants.productId,
        prods.map((p) => p.id),
      ),
    )
    .orderBy(asc(variants.sort), asc(variants.id));
  return prods.map((p) => ({
    ...p,
    variants: vars
      .filter((v) => v.productId === p.id)
      .map((v) => ({
        id: v.id,
        label: v.label,
        sku: v.sku,
        stockQty: v.stockQty,
        sold: v.sold,
        reserved: v.reserved,
        available: availableOf(v),
        sort: v.sort,
      })),
  }));
}

export async function getProduct(db: Db, id: number) {
  const [p] = await db.select().from(products).where(eq(products.id, id));
  if (!p) return null;
  const [d] = await db.select().from(drops).where(eq(drops.id, p.dropId));
  const prods = await dropProducts(db, p.dropId);
  const product = prods.find((x) => x.id === id)!;
  const [{ n: orderLines }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orderItems)
    .innerJoin(variants, eq(variants.id, orderItems.variantId))
    .where(eq(variants.productId, id));
  return { product, drop: d, hasOrders: orderLines > 0 };
}

/** The overview: money, the shipping queue, and how the selling drop is moving. */
export async function overview(db: Db) {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const [all] = await db
    .select({
      orders: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      units: sql<number>`coalesce(sum((select sum(qty) from order_items oi where oi.order_id = ${orders.id})), 0)::int`,
    })
    .from(orders)
    .where(inArray(orders.status, [...SOLD_STATUSES]));
  const [last30] = await db
    .select({
      orders: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
    })
    .from(orders)
    .where(and(inArray(orders.status, [...SOLD_STATUSES]), gte(orders.paidAt, since30)));
  const counts = await orderCounts(db);
  const recent = await listOrders(db, "all", "");
  const allDrops = await listDrops(db);
  const current = allDrops.find((d) => d.status === "live") ?? null;
  return {
    totals: { orders: all.orders, revenueCents: all.revenue, units: all.units },
    last30: { orders: last30.orders, revenueCents: last30.revenue },
    counts,
    recent: recent.slice(0, 8),
    current: current ? { ...current, products: await dropProducts(db, current.id) } : null,
    draftCount: allDrops.filter((d) => d.status === "draft").length,
  };
}

export async function listAdmins(db: Db) {
  return db.select().from(admins).orderBy(asc(admins.createdAt));
}
