"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { drops, orderItems, products, variants, DROP_STATUSES } from "@/db/schema";
import { adminOrError, NOT_ALLOWED, type ActionResult } from "@/lib/admin/auth";

type Created = ActionResult & { id?: number };

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug needs at least 2 characters")
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers and single dashes only");

const cents = z.number().int().min(0, "Can't be negative").max(1_000_000, "That's over $10,000");

/** "" → null, else a real date. The form sends datetime-local values converted to ISO in the browser. */
const optionalDate = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "That date isn't valid" });
      return z.NEVER;
    }
    return d;
  });

/** Postgres error code, whether thrown bare (postgres-js) or wrapped (Drizzle's DrizzleQueryError.cause). */
function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.cause?.code ?? e?.code;
}

function uniqueViolation(err: unknown): boolean {
  return pgCode(err) === "23505";
}

function refreshCatalog() {
  revalidatePath("/admin", "layout");
  revalidatePath("/shop", "layout");
}

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Check the form";
}

// ---- Drops -------------------------------------------------------------------

const dropSchema = z
  .object({
    title: z.string().trim().min(1, "Give the drop a title").max(120),
    slug,
    blurb: z.string().trim().max(1000),
    status: z.enum(DROP_STATUSES),
    startsAt: optionalDate,
    endsAt: optionalDate,
    shippingCents: cents,
  })
  .refine((d) => !(d.startsAt && d.endsAt && d.endsAt <= d.startsAt), {
    message: "The drop has to end after it starts",
  });

export type DropInput = z.input<typeof dropSchema>;

export async function createDrop(input: DropInput): Promise<Created> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const p = dropSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  const db = await getDb();
  try {
    const [row] = await db.insert(drops).values(p.data).returning({ id: drops.id });
    refreshCatalog();
    return { ok: true, id: row.id };
  } catch (err) {
    if (uniqueViolation(err)) return { ok: false, error: "Another drop already uses that slug." };
    throw err;
  }
}

export async function updateDrop(id: number, input: DropInput): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const p = dropSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  const db = await getDb();
  if (p.data.status === "live") {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(products)
      .where(and(eq(products.dropId, id), eq(products.active, 1)));
    if (n === 0) return { ok: false, error: "Add at least one visible product before going live." };
  }
  try {
    await db.update(drops).set(p.data).where(eq(drops.id, id));
  } catch (err) {
    if (uniqueViolation(err)) return { ok: false, error: "Another drop already uses that slug." };
    throw err;
  }
  refreshCatalog();
  return { ok: true, message: "Drop saved." };
}

// ---- Products ----------------------------------------------------------------

const productSchema = z.object({
  name: z.string().trim().min(1, "Give the product a name").max(120),
  slug,
  description: z.string().trim().max(4000),
  priceCents: cents.refine((n) => n >= 50, "Stripe's minimum charge is $0.50"),
  active: z.boolean(),
  sort: z.number().int().min(0).max(1000),
});

export type ProductInput = z.input<typeof productSchema>;

export async function createProduct(dropId: number, input: ProductInput): Promise<Created> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const p = productSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  const db = await getDb();
  try {
    const [row] = await db
      .insert(products)
      .values({ ...p.data, active: p.data.active ? 1 : 0, dropId })
      .returning({ id: products.id });
    refreshCatalog();
    return { ok: true, id: row.id };
  } catch (err) {
    if (uniqueViolation(err)) return { ok: false, error: "Another product already uses that slug." };
    throw err;
  }
}

export async function updateProduct(id: number, input: ProductInput): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const p = productSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  const db = await getDb();
  try {
    await db
      .update(products)
      .set({ ...p.data, active: p.data.active ? 1 : 0 })
      .where(eq(products.id, id));
  } catch (err) {
    if (uniqueViolation(err)) return { ok: false, error: "Another product already uses that slug." };
    throw err;
  }
  refreshCatalog();
  return { ok: true, message: "Product saved." };
}

/** Photos are uploaded from the browser to the `media` bucket; this stores the ordered list. First = cover. */
export async function setProductImages(id: number, images: string[]): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const clean = images.filter((u) => /^https:\/\/[^\s]+$/.test(u) || /^\/[^\s]*$/.test(u)).slice(0, 12);
  const db = await getDb();
  await db.update(products).set({ images: clean }).where(eq(products.id, id));
  refreshCatalog();
  return { ok: true, message: "Photos saved." };
}

/** Only a product nobody has ordered can be deleted; otherwise hide it (order history points at it). */
export async function deleteProduct(id: number): Promise<ActionResult & { dropId?: number }> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const db = await getDb();
  const [p] = await db.select({ dropId: products.dropId }).from(products).where(eq(products.id, id));
  if (!p) return { ok: false, error: "Product not found." };
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orderItems)
    .innerJoin(variants, eq(variants.id, orderItems.variantId))
    .where(eq(variants.productId, id));
  if (n > 0) return { ok: false, error: "This product has orders. Hide it instead of deleting it." };
  await db.transaction(async (tx) => {
    await tx.delete(variants).where(eq(variants.productId, id));
    await tx.delete(products).where(eq(products.id, id));
  });
  refreshCatalog();
  return { ok: true, dropId: p.dropId };
}

// ---- Variants (sizes) ----------------------------------------------------------

const variantSchema = z.object({
  label: z.string().trim().min(1, "Name the size, e.g. M or One size").max(60),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Add a SKU")
    .max(60)
    .regex(/^[A-Z0-9][A-Z0-9-_.]*$/, "SKU: letters, numbers, dashes"),
  /** null = unlimited (print-to-order) */
  stockQty: z.number().int().min(0).max(100_000).nullable(),
  sort: z.number().int().min(0).max(1000),
});

export type VariantInput = z.input<typeof variantSchema>;

export async function addVariant(productId: number, input: VariantInput): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const p = variantSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  const db = await getDb();
  try {
    await db.insert(variants).values({ ...p.data, productId });
  } catch (err) {
    if (uniqueViolation(err)) return { ok: false, error: "That SKU is already used." };
    throw err;
  }
  refreshCatalog();
  return { ok: true, message: "Size added." };
}

export async function updateVariant(id: number, input: VariantInput): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const p = variantSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  const db = await getDb();
  const [v] = await db.select().from(variants).where(eq(variants.id, id));
  if (!v) return { ok: false, error: "Size not found." };
  if (p.data.stockQty !== null && p.data.stockQty < v.sold + v.reserved) {
    return {
      ok: false,
      error: `Stock can't go below ${v.sold + v.reserved}: ${v.sold} sold and ${v.reserved} held in open checkouts.`,
    };
  }
  try {
    await db.update(variants).set(p.data).where(eq(variants.id, id));
  } catch (err) {
    if (uniqueViolation(err)) return { ok: false, error: "That SKU is already used." };
    // variants_no_oversell: a checkout grabbed units between the read and the write.
    if (pgCode(err) === "23514") {
      return { ok: false, error: "Someone just checked out. Reload and try again." };
    }
    throw err;
  }
  refreshCatalog();
  return { ok: true, message: "Size saved." };
}

export async function deleteVariant(id: number): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orderItems)
    .where(eq(orderItems.variantId, id));
  if (n > 0) return { ok: false, error: "This size has orders. Set its stock to what's sold instead." };
  await db.delete(variants).where(eq(variants.id, id));
  refreshCatalog();
  return { ok: true, message: "Size removed." };
}
