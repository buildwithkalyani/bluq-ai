import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import dotenv from "dotenv";
import { healthRoute } from "./routes/health.js";
import { projectsRoute } from "./routes/projects.js";
import { tasksRoute } from "./routes/tasks.js";
import { dprsRoute } from "./routes/dprs.js";

dotenv.config();

const app = Fastify({ logger: true });

async function start() {
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

  await app.register(healthRoute);
  await app.register(projectsRoute);
  await app.register(tasksRoute);
  await app.register(dprsRoute);

  try {
    await app.listen({ 
      port: Number(process.env.PORT) || 3001, 
      host: "0.0.0.0" 
    });
    console.log("🚀 Bluq API running!");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();