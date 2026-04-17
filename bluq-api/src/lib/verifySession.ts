import { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";

// Augment FastifyRequest so route handlers can access the authenticated userId
declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export async function verifySession(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const rows = await db.execute(
      sql`SELECT user_id, expires_at FROM session WHERE token = ${token} LIMIT 1`
    );

    const session = (rows[0] ?? null) as { user_id: string; expires_at: string } | null;

    if (session === null) {
      return reply.status(401).send({ error: "Invalid session" });
    }

    if (new Date(session.expires_at) < new Date()) {
      return reply.status(401).send({ error: "Session expired" });
    }

    request.userId = session.user_id;
  } catch (err: any) {
    console.error("verifySession error:", err.message, err.cause ?? err);
    return reply.status(500).send({ error: "Auth check failed" });
  }
}
