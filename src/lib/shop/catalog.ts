import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import type { Db } from "@/db";
import { drops, products, variants } from "@/db/schema";

export type DropRow = typeof drops.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type VariantRow = typeof variants.$inferSelect;

export type ShopVariant = Pick<VariantRow, "id" | "label" | "sku"> & {
  /** null = unlimited */
  available: number | null;
  /** true when every unit is sold or held, but some are only held (an open checkout may let go). */
  heldOnly: boolean;
};

export type ShopProduct = Pick<ProductRow, "id" | "slug" | "name" | "description" | "priceCents" | "images"> & {
  variants: ShopVariant[];
  soldOut: boolean;
};

export type DropPhase = "upcoming" | "open" | "ended";

export type ShopDrop = Pick<DropRow, "id" | "slug" | "title" | "blurb" | "shippingCents"> & {
  startsAt: Date | null;
  endsAt: Date | null;
  phase: DropPhase;
  products: ShopProduct[];
};

export function availableOf(v: Pick<VariantRow, "stockQty" | "sold" | "reserved">): number | null {
  if (v.stockQty === null) return null;
  return Math.max(0, v.stockQty - v.sold - v.reserved);
}

/** Where a drop is in its life, from its status and window. Pure, so it's tested. */
export function dropPhase(d: Pick<DropRow, "status" | "startsAt" | "endsAt">, now = new Date()): DropPhase {
  if (d.status === "closed") return "ended";
  if (d.endsAt && now >= d.endsAt) return "ended";
  if (d.startsAt && now < d.startsAt) return "upcoming";
  return "open";
}

function toShopVariant(v: VariantRow): ShopVariant {
  const available = availableOf(v);
  const heldOnly = available === 0 && v.stockQty !== null && v.sold < v.stockQty;
  return { id: v.id, label: v.label, sku: v.sku, available, heldOnly };
}

async function loadProducts(db: Db, dropId: number): Promise<ShopProduct[]> {
  const prods = await db
    .select()
    .from(products)
    .where(and(eq(products.dropId, dropId), eq(products.active, 1)))
    .orderBy(asc(products.sort), asc(products.id));
  if (prods.length === 0) return [];
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
  return prods.map((p) => {
    const vs = vars.filter((v) => v.productId === p.id).map(toShopVariant);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      priceCents: p.priceCents,
      images: p.images,
      variants: vs,
      soldOut: vs.length === 0 || vs.every((v) => v.available === 0),
    };
  });
}

function toShopDrop(d: DropRow, prods: ShopProduct[], now: Date): ShopDrop {
  return {
    id: d.id,
    slug: d.slug,
    title: d.title,
    blurb: d.blurb,
    shippingCents: d.shippingCents,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    phase: dropPhase(d, now),
    products: prods,
  };
}

/**
 * The drop /shop shows: the newest live drop, else the newest closed one (so the
 * page reads "sold out / ended" rather than going blank). Drafts never show.
 */
export async function getCurrentDrop(db: Db, now = new Date()): Promise<ShopDrop | null> {
  const rows = await db
    .select()
    .from(drops)
    .where(ne(drops.status, "draft"))
    .orderBy(desc(drops.status), desc(drops.createdAt), desc(drops.id));
  // status sorts "live" > "closed" descending, so a live drop wins.
  const d = rows[0];
  if (!d) return null;
  return toShopDrop(d, await loadProducts(db, d.id), now);
}

export async function getProductPage(
  db: Db,
  slug: string,
  now = new Date(),
): Promise<{ drop: ShopDrop; product: ShopProduct } | null> {
  const [p] = await db.select().from(products).where(and(eq(products.slug, slug), eq(products.active, 1)));
  if (!p) return null;
  const [d] = await db.select().from(drops).where(eq(drops.id, p.dropId));
  if (!d || d.status === "draft") return null;
  const prods = await loadProducts(db, d.id);
  const product = prods.find((x) => x.id === p.id);
  if (!product) return null;
  return { drop: toShopDrop(d, prods, now), product };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
