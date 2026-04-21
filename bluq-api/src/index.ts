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

import dotenv from "dotenv";
dotenv.config();

import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";

// Routes
import { healthRoute } from "./routes/health.js";
import { projectsRoute } from "./routes/projects.js";
import { tasksRoute } from "./routes/tasks.js";
import { dprsRoute } from "./routes/dprs.js";
import { demoRequestsRoute } from "./routes/demo-requests.js";
import { documentsRoute } from "./routes/documents.js";
import { scheduleRoute } from "./routes/schedule.js";
import { whatsappRoute } from "./routes/whatsapp.js";
import { reportsRoute } from "./routes/reports.js";
import { orgsRoute } from "./routes/orgs.js";
import { teamRoute } from "./routes/team.js";

// Workers
import { startSchedulerWorker } from "./workers/ai-scheduler.worker.js";
import { startWhatsappWorker } from "./workers/whatsapp.worker.js";
import { startCronWorker } from "./workers/cron.worker.js";
import { startPdfWorker } from "./workers/pdf.worker.js";
import { initSocketServer } from "./lib/socket.js";

const app = Fastify({ logger: true });

// ---------------------------------------------------------------------------
// RAW BODY CAPTURE
// Replaces default JSON parser to store the raw Buffer on request.
// Required for Meta webhook signature verification (X-Hub-Signature-256).
// ---------------------------------------------------------------------------
app.addContentTypeParser(
  "application/json",
  { parseAs: "buffer" },
  (req, body, done) => {
    (req as any).rawBody = body as Buffer;
    try {
      done(null, JSON.parse((body as Buffer).toString()));
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  }
);

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
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
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
  await app.register(whatsappRoute);       // NEW
  await app.register(reportsRoute);        // NEW
  await app.register(orgsRoute);           // NEW
  await app.register(teamRoute);           // NEW

  // =========================================================================
  // START WORKER
  // =========================================================================
  // The worker runs in the same process as the server.
  // It listens to the "ai-scheduler" BullMQ queue (defined in queues.ts)
  // and processes schedule generation jobs in the background.
  startSchedulerWorker();
  startWhatsappWorker();
  startPdfWorker();
  startCronWorker();

  // =========================================================================
  // START SERVER
  // =========================================================================
  try {
    await app.listen({
      port: Number(process.env.PORT) || 3001,
      host: "0.0.0.0",
    });
    // Socket.IO must be attached AFTER listen() — app.server is only available then
    initSocketServer(app.server);
    console.log("🚀 Bluq API running!");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();