import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// Pulls the long rediss:// URL from your .env
const redisUrl = process.env.UPSTASH_REDIS_URL;

if (!redisUrl) {
  throw new Error("❌ UPSTASH_REDIS_URL is missing in environment variables");
}

// Global connection to be shared across the whole app
export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ to handle its own retries
  tls: {
    rejectUnauthorized: false // Required for some cloud providers like Upstash
  }
});

redisConnection.on("error", (err) => console.error("Redis Connection Error:", err));