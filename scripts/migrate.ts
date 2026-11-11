/**
 * Apply drizzle/ migrations.
 *   npx tsx scripts/migrate.ts            → the DB in POSTGRES_URL_NON_POOLING / DATABASE_URL
 *   npx tsx scripts/migrate.ts --pglite   → local .pglite/
 * Uses the session pooler (POSTGRES_URL_NON_POOLING) when present: DDL through
 * the transaction pooler (:6543) is unreliable.
 *
 * Why not drizzle's migrate(): it runs `CREATE SCHEMA IF NOT EXISTS "drizzle"`,
 * and a least-privilege app role with CREATE on `public` only — Postgres checks
 * the database-level CREATE privilege before IF NOT EXISTS, so it fails even
 * when the schema exists. This runner applies the same files from the drizzle
 * journal and records them in public.__drizzle_migrations, in drizzle's own
 * format (sha256 hash + journal timestamp), so drizzle-kit can take over later.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  if (process.argv.includes("--pglite")) {
    const { connectPglite, pgliteDir } = await import("../src/db");
    await connectPglite(pgliteDir()); // migrates on open
    console.log(`Migrated PGlite at ${pgliteDir()}`);
    return;
  }
  const url = [process.env.POSTGRES_URL_NON_POOLING, process.env.DATABASE_URL, process.env.POSTGRES_URL].find((u) => u?.startsWith("postgres"));
  if (!url) throw new Error("No Postgres URL (POSTGRES_URL_NON_POOLING / DATABASE_URL).");
  const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  await client`create table if not exists public.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
  // Same rule as every app table: RLS on, no policies (hidden from the Data API).
  await client`alter table public.__drizzle_migrations enable row level security`;
  const done = new Set((await client`select hash from public.__drizzle_migrations`).map((r) => r.hash as string));
  const journal = JSON.parse(readFileSync(path.join("drizzle", "meta", "_journal.json"), "utf8")) as {
    entries: Array<{ tag: string; when: number }>;
  };
  let applied = 0;
  for (const entry of journal.entries) {
    const sqlText = readFileSync(path.join("drizzle", `${entry.tag}.sql`), "utf8");
    const hash = createHash("sha256").update(sqlText).digest("hex");
    if (done.has(hash)) continue;
    await client.begin(async (tx) => {
      for (const stmt of sqlText.split("--> statement-breakpoint").map((x) => x.trim()).filter(Boolean)) {
        await tx.unsafe(stmt);
      }
      await tx`insert into public.__drizzle_migrations (hash, created_at) values (${hash}, ${entry.when})`;
    });
    console.log(`applied ${entry.tag}`);
    applied++;
  }
  console.log(`Migrated ${new URL(url).host} (${applied} new)`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
