import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

// `generate` needs no connection. `migrate`/`push` do — and those are only ever
// run deliberately, against a database that has been approved (see docs/SHOP.md).
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DIRECT_URL ??
      process.env.POSTGRES_URL ??
      process.env.DATABASE_URL ??
      "",
  },
});
