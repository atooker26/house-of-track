import { asc, desc, inArray, ne } from "drizzle-orm";
import type { Db } from "@/db";
import { drops, products, variants } from "@/db/schema";
import { availableOf, dropPhase } from "./catalog";

/**
 * TEGO catalog feed, contract v1 (TEGO docs/catalog-feed.md; reference: Pyramid
 * Printing src/lib/feeds/catalog.ts). Lets House of Track drop shop products into
 * TEGO emails as cards. Public data only: no stock counts, SKUs or orders.
 *
 * Items are every visible product of every drop that isn't a draft (live and
 * closed), newest drop first. Each drop is a "store" in TEGO's picker.
 */

export const FEED_SITE = "house-of-track";
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const MAX_IDS = 100;

export class FeedNotFound extends Error {}

export type FeedQuery = { q: string | null; ids: string[] | null; store: string | null; limit: number; offset: number };

export function parseFeedQuery(p: URLSearchParams): FeedQuery {
  const q = p.get("q")?.trim().slice(0, 100) || null;
  const ids = p.get("ids")
    ? p
        .get("ids")!
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, MAX_IDS)
    : null;
  const storeRaw = p.get("store")?.trim().toLowerCase() || null;
  const store = storeRaw && /^[a-z0-9-]{1,60}$/.test(storeRaw) ? storeRaw : storeRaw ? "\u0000" : null;
  const n = Number(p.get("limit"));
  const limit = Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_LIMIT) : DEFAULT_LIMIT;
  return { q, ids, store, limit, offset: decodeCursor(p.get("cursor")) };
}

export function encodeCursor(offset: number): string {
  return Buffer.from(String(offset)).toString("base64url");
}

export function decodeCursor(raw: string | null): number {
  if (!raw) return 0;
  const n = Number(Buffer.from(raw, "base64url").toString());
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export function feedSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.SITE_URL?.trim().replace(/\/$/, "");
  return raw && /^https:\/\//.test(raw) ? raw : "https://www.houseoftrack.media";
}

function absolute(url: string, site: string): string {
  return /^https?:\/\//.test(url) ? url : `${site}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function buildProductFeed(db: Db, query: FeedQuery, site: string, now = new Date()) {
  const dropRows = await db
    .select()
    .from(drops)
    .where(ne(drops.status, "draft"))
    .orderBy(desc(drops.createdAt), desc(drops.id));
  const visibleDrops = query.store ? dropRows.filter((d) => d.slug === query.store) : dropRows;
  if (query.store && visibleDrops.length === 0) throw new FeedNotFound();
  if (!visibleDrops.length) return { version: 1 as const, site: FEED_SITE, items: [], nextCursor: null };

  const prods = await db
    .select()
    .from(products)
    .where(
      inArray(
        products.dropId,
        visibleDrops.map((d) => d.id),
      ),
    )
    .orderBy(asc(products.sort), asc(products.id));
  const active = prods.filter((p) => p.active === 1);
  const vars = active.length
    ? await db
        .select()
        .from(variants)
        .where(
          inArray(
            variants.productId,
            active.map((p) => p.id),
          ),
        )
    : [];

  const dropOrder = new Map(visibleDrops.map((d, i) => [d.id, i]));
  let items = active
    .sort((a, b) => dropOrder.get(a.dropId)! - dropOrder.get(b.dropId)!)
    .map((p) => {
      const d = visibleDrops.find((x) => x.id === p.dropId)!;
      const phase = dropPhase(d, now);
      const vs = vars.filter((v) => v.productId === p.id);
      const inStock = vs.some((v) => availableOf(v) !== 0);
      const badge =
        phase === "upcoming" && d.startsAt
          ? `Drops ${d.startsAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" })}`
          : phase === "ended"
            ? "Drop closed"
            : !inStock
              ? "Sold out"
              : undefined;
      const images = p.images.map((u) => ({ url: absolute(u, site), alt: p.name }));
      return {
        id: `product-${p.id}`,
        kind: "product" as const,
        title: p.name,
        url: `${site}/shop/${p.slug}`,
        ...(images[0] ? { image: images[0], images } : {}),
        priceFrom: p.priceCents,
        priceTo: p.priceCents,
        currency: "usd" as const,
        ...(badge ? { badge } : {}),
        store: { slug: d.slug, name: d.title, listed: true },
        ...(p.description ? { summary: p.description.slice(0, 400) } : {}),
        inStock: inStock && phase === "open",
      };
    });

  if (query.ids) {
    const want = new Set(query.ids);
    items = items.filter((i) => want.has(i.id));
  }
  if (query.q) {
    const q = query.q.toLowerCase();
    items = items.filter((i) => i.title.toLowerCase().includes(q));
  }
  const page = items.slice(query.offset, query.offset + query.limit);
  const next = query.offset + query.limit;
  return { version: 1 as const, site: FEED_SITE, items: page, nextCursor: next < items.length ? encodeCursor(next) : null };
}

