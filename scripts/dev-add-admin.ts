/**
 * Local dev only: put a Supabase Auth user on the PGlite admin list, so you can
 * sign in to /admin locally with a real login against local shop data.
 *   npm run db:dev:admin -- <user-uuid> <email>
 */
import { connectPglite, pgliteDir } from "../src/db";
import { admins } from "../src/db/schema";

const [userId, email] = process.argv.slice(2);
if (!userId || !email) {
  console.error("usage: npm run db:dev:admin -- <user-uuid> <email>");
  process.exit(1);
}
async function main() {
  const db = await connectPglite(pgliteDir());
  await db.insert(admins).values({ userId, email }).onConflictDoNothing();
  console.log(`admin ${email} added to ${pgliteDir()}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
