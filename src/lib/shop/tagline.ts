import { eq } from "drizzle-orm";
import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";
import type { Db } from "@/db";
import { DEFAULT_TAGLINE } from "./tagline-defaults";

export { DEFAULT_TAGLINE, TAGLINE_MAX } from "./tagline-defaults";

/**
 * The red (coral) line above the product name on /shop/[slug] — ticket #108.
 * Per drop, edited on /admin/drops/[id]: a show/hide toggle and the text.
 * Off = the eyebrow falls back to the drop title (what it showed before).
 *
 * Columns `drops.tagline_on` / `drops.tagline` come from drizzle/0004. They are
 * deliberately NOT in src/db/schema.ts yet: Drizzle lists every schema column
 * in inserts and in `select()` / joins on `drops`, so adding them there would
 * break checkout and drop creation on any database where 0004 hasn't been
 * applied. This narrow view of the table is read and written only here, and
 * "column doesn't exist" (42703) falls back to the default instead of failing.
 * Once 0004 is applied everywhere, these two columns can move into schema.ts.
 */

export type DropTagline = {
  on: boolean;
  text: string;
  /** False when the columns don't exist yet (migration 0004 not applied). */
  stored: boolean;
};

const FALLBACK: DropTagline = { on: true, text: DEFAULT_TAGLINE, stored: false };

// Not exported to drizzle-kit (it reads src/db/schema.ts only).
const dropTaglines = pgTable("drops", {
  id: integer("id").primaryKey(),
  taglineOn: boolean("tagline_on").notNull(),
  tagline: text("tagline").notNull(),
});

function missingColumn(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return (e?.cause?.code ?? e?.code) === "42703";
}

export async function getDropTagline(db: Db, dropId: number): Promise<DropTagline> {
  try {
    const [row] = await db
      .select({ on: dropTaglines.taglineOn, text: dropTaglines.tagline })
      .from(dropTaglines)
      .where(eq(dropTaglines.id, dropId));
    return row ? { on: row.on, text: row.text.trim() || DEFAULT_TAGLINE, stored: true } : FALLBACK;
  } catch (err) {
    if (missingColumn(err)) return FALLBACK;
    throw err;
  }
}

/** False when the columns don't exist yet, so the caller can say so instead of pretending it saved. */
export async function setDropTagline(db: Db, dropId: number, on: boolean, text: string): Promise<boolean> {
  try {
    await db
      .update(dropTaglines)
      .set({ taglineOn: on, tagline: text.trim() || DEFAULT_TAGLINE })
      .where(eq(dropTaglines.id, dropId));
    return true;
  } catch (err) {
    if (missingColumn(err)) return false;
    throw err;
  }
}

/** What the coral eyebrow on the product page says. */
export function eyebrowFor(t: DropTagline, dropTitle: string): string {
  return t.on ? t.text : dropTitle;
}
