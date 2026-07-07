import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// Pulls the redis:// (Railway) or rediss:// (Upstash) URL from your .env
const redisUrl = process.env.UPSTASH_REDIS_URL;

if (!redisUrl) {
  throw new Error("❌ UPSTASH_REDIS_URL is missing in environment variables");
}

// TLS only applies to rediss:// URLs (e.g. Upstash). Plain redis:// (e.g. Railway) must not set tls.
const useTls = redisUrl.startsWith("rediss://");

// Global connection to be shared across the whole app
export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ to handle its own retries
  ...(useTls ? { tls: { rejectUnauthorized: false } } : {}),
});

redisConnection.on("error", (err) => console.error("Redis Connection Error:", err));