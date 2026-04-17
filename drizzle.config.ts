import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_DATABASE_URL ?? process.env.SUPABASE_DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  },
  out: "./drizzle",
  schema: "./bluq-api/src/db/schema.ts",
  // REMOVE schemaFilter entirely for this test
  verbose: true,
  strict: true,
});
