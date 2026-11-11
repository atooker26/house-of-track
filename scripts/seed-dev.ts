/**
 * Local-only stand-in catalog: "Drop 01 — Corduroy Hat", 50 units.
 *
 *   npx tsx scripts/seed-dev.ts      → .pglite/ (stop `next dev` first: PGlite locks its directory)
 *
 * Refuses to touch anything but PGlite. The price and photos are placeholders
 * (the existing merch art in public/assets), not the real drop.
 */
import { eq } from "drizzle-orm";
import { connectPglite, pgliteDir } from "../src/db";
import { drops, products, variants } from "../src/db/schema";

async function main() {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    console.error("seed-dev only writes to local PGlite. Unset DATABASE_URL / POSTGRES_URL.");
    process.exit(1);
  }
  const db = await connectPglite(pgliteDir());

  const existing = await db.select().from(drops).where(eq(drops.slug, "drop-01"));
  if (existing.length) {
    console.log("drop-01 already seeded.");
    return;
  }

  const startsAt = process.argv.includes("--upcoming") ? new Date(Date.now() + 3 * 86400_000) : null;
  const [drop] = await db
    .insert(drops)
    .values({
      slug: "drop-01",
      title: "Drop 01 — Corduroy Hat",
      blurb: "Fifty corduroy hats. One run. When they're gone, they're gone.",
      status: "live",
      startsAt,
      shippingCents: 600,
    })
    .returning();

  const [hat] = await db
    .insert(products)
    .values({
      dropId: drop.id,
      slug: "corduroy-hat",
      name: "Corduroy Hat",
      description: "Placeholder copy. Six-panel corduroy, embroidered House of Track mark, adjustable strap.",
      priceCents: 3800,
      images: ["/assets/merch-midnight-mulberry.png", "/assets/merch-asphalt-fog.png", "/assets/merch-brick-dust.png"],
      sort: 0,
    })
    .returning();
  await db.insert(variants).values({ productId: hat.id, label: "One size", sku: "HOT-D01-HAT-OS", stockQty: 50 });

  console.log(`Seeded drop-01 (50 hats${startsAt ? `, opens ${startsAt.toISOString()}` : ", open now"}) at ${pgliteDir()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
