import { db } from "../db/client.js";
import { auditEvents } from "../db/schema.js";

export async function logAudit(event: {
  workspaceId: string;
  projectId?: string | null;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  actorType?: "user" | "ai" | "system" | "whatsapp";
  payload?: Record<string, unknown>;
  aiAnalysis?: string;
}) {
  await db.insert(auditEvents).values({
    workspaceId: event.workspaceId,
    projectId: event.projectId ?? null,
    eventType: event.eventType,
    entityType: event.entityType,
    entityId: event.entityId ?? null,
    actorId: event.actorId ?? null,
    actorType: event.actorType ?? "user",
    payload: event.payload ?? null,
    aiAnalysis: event.aiAnalysis ?? null,
  }).catch((err) => {
    console.error("[audit] Failed to log event:", event.eventType, err.message);
  });
}
