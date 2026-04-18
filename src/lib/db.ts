import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true, ca: process.env.SUPABASE_CA_CERT?.replace(/\\n/g, "\n") }
    : { rejectUnauthorized: false },
});
