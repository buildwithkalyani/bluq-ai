import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";

// 1. For AI-driven schedule analysis (Claude)
export const aiSchedulerQueue = new Queue("ai-scheduler", { 
  connection: redisConnection 
});

// 2. For processing incoming site updates from WhatsApp
export const whatsappQueue = new Queue("whatsapp-processor", { 
  connection: redisConnection 
});

// 3. For generating heavy PDF reports (DPRs)
export const pdfQueue = new Queue("pdf-generator", { 
  connection: redisConnection 
});