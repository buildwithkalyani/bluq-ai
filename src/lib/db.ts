import { Pool } from "pg";

const connectionString = process.env.SUPABASE_DATABASE_URL?.replace(/([?&])sslmode=[^&]*/g, "$1").replace(/[?&]$/, "");

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
