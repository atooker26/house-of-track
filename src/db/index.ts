import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import path from "node:path";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

/**
 * The connection string, or null.
 *
 * Takes the first candidate that actually looks like a Postgres URL, not the
 * first that is merely set: `vercel env pull` writes Sensitive vars as the
 * literal string "[SENSITIVE]", which passes every `??` guard and then dies as
 * "Invalid URL" somewhere unrelated (see LB Mile).
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const candidates = [env.DATABASE_URL, env.POSTGRES_URL, env.POSTGRES_PRISMA_URL];
  return candidates.find((c) => typeof c === "string" && c.startsWith("postgres")) ?? null;
}

/**
 * PGlite (in-process wasm Postgres) is for local dev and tests only. It is
 * used when no real database is configured and we're not in production — or
 * when USE_PGLITE=1 forces it (e.g. `next start` on a laptop).
 */
function shouldUsePglite(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.USE_PGLITE === "1") return true;
  return !resolveDatabaseUrl(env) && env.NODE_ENV !== "production";
}

export function pgliteDir(): string {
  return process.env.PGLITE_DIR ?? path.join(process.cwd(), ".pglite");
}

let dbPromise: Promise<Db> | null = null;

/**
 * Lazily connect. Nothing connects at import time, so `next build` works with
 * no DATABASE_URL at all — every page that reads the catalog is dynamic and
 * only calls this per request.
 */
export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = connect().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

async function connect(): Promise<Db> {
  if (shouldUsePglite()) return connectPglite(pgliteDir());

  const url = resolveDatabaseUrl();
  if (!url) {
    // Loud and early, per LB Mile: a wrong default would turn a missing env
    // var into a silently broken checkout.
    throw new Error("No database: set DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL).");
  }
  const client = postgres(url, { prepare: false });
  return drizzle(client, { schema });
}

/**
 * Open (and migrate) a PGlite database. `dataDir` undefined = in-memory (tests).
 * Imports are hidden from the bundler: PGlite is a devDependency and is never
 * reached in production.
 */
export async function connectPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ "drizzle-orm/pglite"
  );
  const { migrate } = await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ "drizzle-orm/pglite/migrator"
  );
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzlePglite(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  // Same query-builder surface at runtime; the cast keeps one Db type app-wide.
  return db as unknown as Db;
}
