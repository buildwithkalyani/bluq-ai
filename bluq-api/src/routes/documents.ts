// =============================================================================
// DOCUMENTS ROUTE
// =============================================================================
// Manages file references for project documents.
//
// Flow:
//   1. Aishna's frontend uploads file to Supabase Storage → gets a URL
//   2. Frontend calls POST /documents with that URL + metadata
//   3. This route saves the reference to the documents table
//   4. When PM clicks "Generate Schedule", the worker queries this table
//      to know which files to download and parse
//
// Endpoints:
//   GET    /documents?projectId=xxx&workspaceId=yyy  → list project docs
//   POST   /documents                                → save new doc reference
//   DELETE /documents/:id                            → remove a doc reference
// =============================================================================

import { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { documents } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Allowed file extensions for schedule generation
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

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) return "";
  return fileName.slice(lastDot).toLowerCase();
}

export async function documentsRoute(app: FastifyInstance) {

  // =========================================================================
  // GET /documents — list all documents for a project
  // =========================================================================
  app.get("/documents", async (request, reply) => {
    try {
      const { projectId, workspaceId } = request.query as {
        projectId: string;
        workspaceId: string;
      };

      if (!projectId || !workspaceId) {
        return reply.status(400).send({ error: "projectId and workspaceId required" });
      }
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(workspaceId)) {
        return reply.status(400).send({ error: "projectId and workspaceId must be valid UUIDs" });
      }

      const data = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.projectId, projectId),
            eq(documents.workspaceId, workspaceId)
          )
        )
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
  app.post("/documents", async (request, reply) => {
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

      // Validate required fields
      if (!body.workspaceId || !body.projectId || !body.fileName || !body.fileUrl) {
        return reply.status(400).send({
          error: "workspaceId, projectId, fileName, and fileUrl are required",
        });
      }
      if (!UUID_REGEX.test(body.workspaceId) || !UUID_REGEX.test(body.projectId)) {
        return reply.status(400).send({
          error: "workspaceId and projectId must be valid UUIDs",
        });
      }

      // Check file extension
      const ext = getFileExtension(body.fileName);

      // Reject unsupported formats with helpful message
      if (REJECTED_EXTENSIONS[ext]) {
        return reply.status(400).send({
          error: "Unsupported file format",
          suggestion: REJECTED_EXTENSIONS[ext],
        });
      }

      // Warn about unknown formats (but still allow — might be valid)
      if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
        console.warn(`[documents] Unknown file extension: ${ext} for ${body.fileName}`);
      }

      // Detect file type from extension if not provided
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
  // DELETE /documents/:id — remove a document reference
  // =========================================================================
  app.delete("/documents/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: "id must be a valid UUID" });
      }

      const [deleted] = await db
        .delete(documents)
        .where(eq(documents.id, id))
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