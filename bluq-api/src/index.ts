// =============================================================================
// BLUQ API — Main Server
// =============================================================================
// Fastify server running on Railway.
//
// Registers all routes and starts the BullMQ worker.
//
// Routes:
//   GET    /health              → health check (Railway uses this)
//   GET/POST/PATCH/DELETE /projects   → project CRUD
//   GET/POST/PATCH/DELETE /tasks      → task CRUD
//   GET/POST/PATCH          /dprs       → DPR CRUD
//   GET/POST/PATCH          /demo-requests → landing page leads
//   GET/POST/DELETE         /documents   → document references (NEW)
//   POST   /schedule/generate           → trigger schedule generation (NEW)
//   GET    /schedule/status/:jobId      → poll generation progress (NEW)
//   GET    /schedule/versions           → list schedule versions (NEW)
//   GET    /schedule/versions/:id       → get full schedule (NEW)
//   POST   /schedule/baseline           → lock version as baseline (NEW)
//
// Worker:
//   ai-scheduler → processes schedule generation jobs from Redis queue
// =============================================================================

import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import dotenv from "dotenv";

// Routes
import { healthRoute } from "./routes/health.js";
import { projectsRoute } from "./routes/projects.js";
import { tasksRoute } from "./routes/tasks.js";
import { dprsRoute } from "./routes/dprs.js";
import { demoRequestsRoute } from "./routes/demo-requests.js";
import { documentsRoute } from "./routes/documents.js";
import { scheduleRoute } from "./routes/schedule.js";

// Worker
import { startSchedulerWorker } from "./workers/ai-scheduler.worker.js";

dotenv.config();

const app = Fastify({ logger: true });

async function start() {
  // =========================================================================
  // MIDDLEWARE
  // =========================================================================
  await app.register(cors, {
    origin: [
      "https://bluq.ai",
      "https://www.bluq.ai",
      "https://bluq-ai.vercel.app",
      "http://localhost:3000",
    ],
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // =========================================================================
  // ROUTES
  // =========================================================================
  await app.register(healthRoute);
  await app.register(projectsRoute);
  await app.register(tasksRoute);
  await app.register(dprsRoute);
  await app.register(demoRequestsRoute);
  await app.register(documentsRoute);      // NEW
  await app.register(scheduleRoute);       // NEW

  // =========================================================================
  // START WORKER
  // =========================================================================
  // The worker runs in the same process as the server.
  // It listens to the "ai-scheduler" BullMQ queue (defined in queues.ts)
  // and processes schedule generation jobs in the background.
  startSchedulerWorker();

  // =========================================================================
  // START SERVER
  // =========================================================================
  try {
    await app.listen({
      port: Number(process.env.PORT) || 3001,
      host: "0.0.0.0",
    });
    console.log("🚀 Bluq API running!");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();