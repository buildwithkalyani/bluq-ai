// =============================================================================
// DOCUMENTS ROUTE
// =============================================================================
// Manages file references for project documents.
//
// Flow:
//   1. Frontend calls GET /documents/upload-url → gets signed upload URL
//   2. Frontend PUTs file directly to Supabase Storage using signed URL
//   3. Frontend calls POST /documents with storage path + metadata
//   4. This route saves the reference to the documents table
//   5. When PM clicks "Generate Schedule", worker queries this table,
//      generates signed download URLs, and fetches files
//
// Endpoints:
//   GET    /documents/upload-url                     → get signed upload URL
//   GET    /documents?projectId=xxx&workspaceId=yyy  → list project docs
//   POST   /documents                                → save new doc reference
//   DELETE /documents/:id                            → remove a doc reference
// =============================================================================

import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { documents } from "../db/schema.js";
import { eq, and, desc, gt } from "drizzle-orm";
import { verifySession } from "../lib/verifySession.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".docx", ".xlsx", ".xls", ".csv",
  ".jpg", ".jpeg", ".png", ".webp",
]);

const REJECTED_EXTENSIONS: Record<string, string> = {
  ".dwg": "DWG files cannot be processed. Please export as PDF from AutoCAD: File → Export → PDF.",
  ".dxf": "DXF files cannot be processed. Please export as PDF from your CAD software.",
  ".doc": "Legacy .doc format is not supported. Please save as .docx in Word: File → Save As → Word Document (.docx).",
  ".ifc": "IFC (BIM) support is coming soon. Please export floor plans as PDF from Revit.",
  ".rvt": "Revit files cannot be processed. Please export as PDF: File → Export → PDF.",
};

// 50 MB max upload size
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) return "";
  return fileName.slice(lastDot).toLowerCase();
}

function isValidStoragePath(fileUrl: string, workspaceId: string, projectId: string): boolean {
  const encodedWorkspace = encodeURIComponent(workspaceId);
  const encodedProject = encodeURIComponent(projectId);
  const hasCorrectPath =
    fileUrl.includes(`/${workspaceId}/${projectId}/`) ||
    fileUrl.includes(`/${encodedWorkspace}/${encodedProject}/`) ||
    fileUrl.startsWith(`${workspaceId}/${projectId}/`) ||
    fileUrl.startsWith(`${encodedWorkspace}/${encodedProject}/`);
  if (!hasCorrectPath) return false;
  // If it's a full URL, verify it points to our Supabase instance
  if (fileUrl.startsWith("http")) {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) return false;
    return fileUrl.startsWith(`${supabaseUrl}/storage/v1/object/`);
  }
  // Bare storage path (e.g. "workspaceId/projectId/timestamp-file.pdf") — accepted
  return true;
}

const DOCUMENTS_BUCKET = "documents";

export async function documentsRoute(app: FastifyInstance) {

  // =========================================================================
  // GET /documents/upload-url — generate a signed upload URL for private bucket
  // =========================================================================
  app.get("/documents/upload-url", { preHandler: verifySession }, async (request, reply) => {
    const { fileName, workspaceId, projectId, fileSize } = request.query as {
      fileName: string;
      workspaceId: string;
      projectId: string;
      fileSize?: string;
    };

    if (!fileName || !workspaceId || !projectId) {
      return reply.status(400).send({ error: "fileName, workspaceId, projectId required" });
    }
    if (!UUID_REGEX.test(workspaceId) || !UUID_REGEX.test(projectId)) {
      return reply.status(400).send({ error: "workspaceId and projectId must be valid UUIDs" });
    }

    // Block rejected/unsupported extensions before upload
    const ext = getFileExtension(fileName);
    if (REJECTED_EXTENSIONS[ext]) {
      return reply.status(400).send({ error: "Unsupported file format", suggestion: REJECTED_EXTENSIONS[ext] });
    }
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      return reply.status(400).send({ error: `File type ${ext} is not allowed.` });
    }

    // Enforce size limit (client-reported, enforced again on POST /documents)
    if (fileSize && parseInt(fileSize) > MAX_FILE_SIZE_BYTES) {
      return reply.status(400).send({ error: "File exceeds 50 MB limit." });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return reply.status(500).send({ error: "Storage not configured" });
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${workspaceId}/${projectId}/${Date.now()}-${safeName}`;

    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/upload/sign/${DOCUMENTS_BUCKET}/${storagePath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: 300 }), // 5 min to complete upload
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      return reply.status(500).send({ error: body.message ?? "Failed to generate upload URL" });
    }

    const { url } = await res.json() as { url: string };
    return { signedUrl: `${supabaseUrl}/storage/v1${url}`, storagePath };
  });

  // =========================================================================
  // GET /documents — list all documents for a project
  // =========================================================================
  app.get("/documents", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { projectId, workspaceId, since } = request.query as {
        projectId: string;
        workspaceId: string;
        since?: string;
      };

      if (!projectId || !workspaceId) {
        return reply.status(400).send({ error: "projectId and workspaceId required" });
      }
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(workspaceId)) {
        return reply.status(400).send({ error: "projectId and workspaceId must be valid UUIDs" });
      }
      if (since && isNaN(Date.parse(since))) {
        return reply.status(400).send({ error: "since must be a valid ISO date" });
      }

      const conditions = [
        eq(documents.projectId, projectId),
        eq(documents.workspaceId, workspaceId),
        ...(since ? [gt(documents.createdAt, since)] : []),
      ];

      const data = await db
        .select()
        .from(documents)
        .where(and(...conditions))
        .orderBy(desc(documents.createdAt));

      return data;
    } catch (err: any) {
      console.error("GET /documents error:", err.message);
      return reply.status(500).send({ error: "Failed to fetch documents" });
    }
  });

  // =========================================================================
  // POST /documents — save a new document reference
  // =========================================================================
  app.post("/documents", { preHandler: verifySession }, async (request, reply) => {
    try {
      const body = request.body as {
        workspaceId: string;
        projectId: string;
        fileName: string;
        fileUrl: string;
        fileType?: string;
        fileSize?: number;
        folder?: string;
        description?: string;
        uploadedBy?: string;
      };

      if (!body.workspaceId || !body.projectId || !body.fileName || !body.fileUrl) {
        return reply.status(400).send({ error: "workspaceId, projectId, fileName, and fileUrl are required" });
      }
      if (!UUID_REGEX.test(body.workspaceId) || !UUID_REGEX.test(body.projectId)) {
        return reply.status(400).send({ error: "workspaceId and projectId must be valid UUIDs" });
      }

      // Validate fileUrl points to our Supabase storage (prevent arbitrary URL injection)
      if (!isValidStoragePath(body.fileUrl, body.workspaceId, body.projectId)) {
        return reply.status(400).send({ error: "Invalid file URL." });
      }

      // Re-validate extension (defence-in-depth — upload-url already checks but client could bypass)
      const ext = getFileExtension(body.fileName);
      if (REJECTED_EXTENSIONS[ext]) {
        return reply.status(400).send({ error: "Unsupported file format", suggestion: REJECTED_EXTENSIONS[ext] });
      }
      if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
        return reply.status(400).send({ error: `File type ${ext} is not allowed.` });
      }

      // Re-enforce size limit
      if (body.fileSize && body.fileSize > MAX_FILE_SIZE_BYTES) {
        return reply.status(400).send({ error: "File exceeds 50 MB limit." });
      }

      const fileType = body.fileType || ext.replace(".", "") || "unknown";

      const [newDoc] = await db
        .insert(documents)
        .values({
          workspaceId: body.workspaceId,
          projectId: body.projectId,
          fileName: body.fileName.trim(),
          fileUrl: body.fileUrl,
          fileType,
          fileSize: body.fileSize || null,
          folder: body.folder || "schedule_inputs",
          description: body.description || null,
          uploadedBy: body.uploadedBy || null,
        })
        .returning();

      return reply.status(201).send(newDoc);
    } catch (err: any) {
      console.error("POST /documents error:", err.message);
      return reply.status(500).send({ error: "Failed to save document" });
    }
  });

  // =========================================================================
  // PATCH /documents/:id — update approval status
  // =========================================================================
  app.patch("/documents/:id", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { approvalStatus: string; workspaceId: string };

      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: "id must be a valid UUID" });
      }
      if (!body.workspaceId || !UUID_REGEX.test(body.workspaceId)) {
        return reply.status(400).send({ error: "workspaceId required" });
      }
      if (!["approved", "rejected", "pending"].includes(body.approvalStatus)) {
        return reply.status(400).send({ error: "approvalStatus must be approved, rejected, or pending" });
      }

      const [updated] = await db
        .update(documents)
        .set({
          approvalStatus: body.approvalStatus,
          approvedBy: request.userId ?? null,
          approvedAt: new Date().toISOString(),
        })
        .where(and(eq(documents.id, id), eq(documents.workspaceId, body.workspaceId)))
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: "Document not found" });
      }

      return updated;
    } catch (err: any) {
      console.error("PATCH /documents/:id error:", err.message);
      return reply.status(500).send({ error: "Failed to update document" });
    }
  });

  // =========================================================================
  // GET /documents/:id/download-url — generate a signed download URL
  // =========================================================================
  app.get("/documents/:id/download-url", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { workspaceId } = request.query as { workspaceId?: string };

      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: "id must be a valid UUID" });
      }
      if (!workspaceId || !UUID_REGEX.test(workspaceId)) {
        return reply.status(400).send({ error: "workspaceId required" });
      }

      const [doc] = await db
        .select({ fileUrl: documents.fileUrl })
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.workspaceId, workspaceId)));

      if (!doc) {
        return reply.status(404).send({ error: "Document not found" });
      }

      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) {
        return reply.status(500).send({ error: "Storage not configured" });
      }

      // Extract bare storage path from whatever format is stored in fileUrl.
      // Handles both old full-URL format and new bare-path format.
      let storagePath = doc.fileUrl;
      const prefix = `${supabaseUrl}/storage/v1/object/`;
      if (storagePath.startsWith(prefix)) {
        storagePath = storagePath.slice(prefix.length);
        // Strip bucket name prefix if present (e.g. "documents/workspace/...")
        if (storagePath.startsWith(`${DOCUMENTS_BUCKET}/`)) {
          storagePath = storagePath.slice(DOCUMENTS_BUCKET.length + 1);
        }
      }

      const res = await fetch(
        `${supabaseUrl}/storage/v1/object/sign/${DOCUMENTS_BUCKET}/${storagePath}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expiresIn: 300 }), // 5 min
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        return reply.status(500).send({ error: body.message ?? "Failed to generate download URL" });
      }

      const { signedURL } = await res.json() as { signedURL: string };
      return { signedUrl: `${supabaseUrl}${signedURL}` };
    } catch (err: any) {
      console.error("GET /documents/:id/download-url error:", err.message);
      return reply.status(500).send({ error: "Failed to generate download URL" });
    }
  });

  // =========================================================================
  // DELETE /documents/:id — remove a document reference
  // =========================================================================
  app.delete("/documents/:id", { preHandler: verifySession }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { workspaceId } = request.query as { workspaceId?: string };

      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: "id must be a valid UUID" });
      }
      if (!workspaceId || !UUID_REGEX.test(workspaceId)) {
        return reply.status(400).send({ error: "workspaceId required" });
      }

      // Ownership check — only delete if doc belongs to the caller's workspace
      const [deleted] = await db
        .delete(documents)
        .where(and(eq(documents.id, id), eq(documents.workspaceId, workspaceId)))
        .returning();

      if (!deleted) {
        return reply.status(404).send({ error: "Document not found" });
      }

      // Note: This only deletes the reference in our DB.
      // The actual file in Supabase Storage should be deleted
      // by the frontend (it has the Supabase client).

      return { success: true, id: deleted.id };
    } catch (err: any) {
      console.error("DELETE /documents error:", err.message);
      return reply.status(500).send({ error: "Failed to delete document" });
    }
  });
}