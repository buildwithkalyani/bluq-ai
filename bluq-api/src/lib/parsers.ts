// =============================================================================
// BLUQ FILE PARSER
// =============================================================================
// Converts uploaded project documents into formats Claude can read.
// This is Step 1 of the scheduling pipeline:
//   Upload → PARSE → Extract Params → Rules Engine → Durations → Schedule
//
// Supported:
//   PDF      → base64 image (Claude reads natively via vision)
//   Excel    → text table (exceljs parses sheets → readable text)
//   Word     → plain text (mammoth extracts text from .docx)
//   Images   → base64 image (Claude reads natively via vision)
//   CSV/TSV  → plain text (read as UTF-8 text)
//
// Rejected with guidance:
//   DWG/DXF  → "Export as PDF from AutoCAD: File → Export → PDF"
//   IFC      → "Coming soon — Month 2 roadmap"
//   3D files → "Not relevant for scheduling"
//
// Install: npm install exceljs mammoth
// =============================================================================

import ExcelJS from "exceljs";
import mammoth from "mammoth";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

/** The content type Claude will receive */
export type ParsedContentType = "image" | "text" | "document";

/** A single parsed content block — maps directly to Claude API message content */
export interface ParsedContent {
  type: ParsedContentType;

  // For images (PDF pages, JPG, PNG, WEBP)
  mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf";
  base64Data?: string;

  // For text (Excel tables, Word text, CSV)
  text?: string;
}

/** Result of parsing a single file */
export interface ParsedDocument {
  fileName: string;
  fileType: string;          // original extension
  contentType: ParsedContentType;
  contents: ParsedContent[]; // a PDF might produce multiple pages as images
  metadata: {
    pages?: number;          // for PDFs
    sheets?: number;         // for Excel
    wordCount?: number;      // for Word/text
    dimensions?: string;     // for images
  };
}

/** If parsing fails or file is rejected */
export interface ParseError {
  fileName: string;
  fileType: string;
  error: string;
  suggestion?: string;       // helpful guidance for the user
}

export type ParseResult =
  | { success: true; document: ParsedDocument }
  | { success: false; error: ParseError };

// ---------------------------------------------------------------------------
// FILE TYPE DETECTION
// ---------------------------------------------------------------------------

const FILE_TYPE_MAP: Record<string, string> = {
  // Parseable
  ".pdf": "pdf",
  ".xlsx": "excel",
  ".xls": "excel",
  ".xlsm": "excel",
  ".csv": "csv",
  ".tsv": "tsv",
  ".doc": "word_legacy",
  ".docx": "word",
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".webp": "image",
  ".gif": "image",
  ".bmp": "image",
  ".tiff": "image",
  ".tif": "image",

  // Rejected with guidance
  ".dwg": "dwg",
  ".dxf": "dxf",
  ".ifc": "ifc",
  ".rvt": "revit",
  ".obj": "3d",
  ".stl": "3d",
  ".fbx": "3d",
  ".3ds": "3d",
  ".skp": "3d",
  ".step": "3d",
  ".stp": "3d",
  ".iges": "3d",
  ".igs": "3d",
};

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) return "";
  return fileName.slice(lastDot).toLowerCase();
}

function detectFileType(fileName: string): string {
  const ext = getFileExtension(fileName);
  return FILE_TYPE_MAP[ext] || "unknown";
}

function getMimeType(
  fileName: string
): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf" {
  const ext = getFileExtension(fileName);
  const mimeMap: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/png",   // treat BMP as PNG for Claude
    ".tiff": "image/png",
    ".tif": "image/png",
  };
  return mimeMap[ext] || "image/jpeg";
}

// ---------------------------------------------------------------------------
// INDIVIDUAL PARSERS
// ---------------------------------------------------------------------------

/**
 * Parse PDF — send as base64 document for Claude to read natively.
 * Claude's vision handles PDFs directly — no need to rasterize pages.
 */
async function parsePdf(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const base64 = buffer.toString("base64");

  return {
    fileName,
    fileType: "pdf",
    contentType: "document",
    contents: [
      {
        type: "document",
        mediaType: "application/pdf",
        base64Data: base64,
      },
    ],
    metadata: {},
  };
}

/**
 * Parse Excel — extract all sheets as readable text tables.
 * Claude reads structured text better than raw cell data.
 */
async function parseExcel(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const sheetTexts: string[] = [];

  workbook.eachSheet((sheet) => {
    const rows: string[] = [];

    sheet.eachRow((row) => {
      const values = row.values as any[];
      // ExcelJS row.values is 1-indexed (index 0 is undefined), so slice from 1
      const cells = values.slice(1).map((v) => {
        if (v === null || v === undefined) return "";
        if (typeof v === "object" && v.text) return v.text;      // rich text
        if (typeof v === "object" && v.result) return String(v.result); // formula
        return String(v);
      });
      rows.push(cells.join(","));
    });

    const text = rows.join("\n");
    if (text.trim().length > 0) {
      sheetTexts.push(`=== Sheet: ${sheet.name} ===\n${text}`);
    }
  });

  const combinedText = sheetTexts.join("\n\n");

  return {
    fileName,
    fileType: "excel",
    contentType: "text",
    contents: [
      {
        type: "text",
        text: combinedText,
      },
    ],
    metadata: {
      sheets: workbook.worksheets.length,
      wordCount: combinedText.split(/\s+/).length,
    },
  };
}

/**
 * Parse Word (.docx) — extract plain text using mammoth.
 * Mammoth handles tables, lists, and formatting gracefully.
 */
async function parseWord(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;

  // Log any conversion warnings (non-fatal)
  if (result.messages.length > 0) {
    console.warn(
      `[parsers] mammoth warnings for ${fileName}:`,
      result.messages.map((m) => m.message).join("; ")
    );
  }

  return {
    fileName,
    fileType: "word",
    contentType: "text",
    contents: [
      {
        type: "text",
        text,
      },
    ],
    metadata: {
      wordCount: text.split(/\s+/).filter(Boolean).length,
    },
  };
}

/**
 * Parse image (JPG, PNG, WEBP) — send as base64 for Claude vision.
 * Used for: site photos, hand-drawn sketches, scanned drawings.
 */
async function parseImage(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const base64 = buffer.toString("base64");
  const mediaType = getMimeType(fileName);

  return {
    fileName,
    fileType: "image",
    contentType: "image",
    contents: [
      {
        type: "image",
        mediaType,
        base64Data: base64,
      },
    ],
    metadata: {},
  };
}

/**
 * Parse CSV/TSV — read as plain text.
 */
async function parseCsv(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const text = buffer.toString("utf-8");

  return {
    fileName,
    fileType: getFileExtension(fileName).replace(".", ""),
    contentType: "text",
    contents: [
      {
        type: "text",
        text,
      },
    ],
    metadata: {
      wordCount: text.split(/\s+/).filter(Boolean).length,
    },
  };
}

// ---------------------------------------------------------------------------
// REJECTION MESSAGES
// ---------------------------------------------------------------------------

const REJECTION_MESSAGES: Record<string, ParseError> = {
  dwg: {
    fileName: "",
    fileType: "dwg",
    error: "DWG files cannot be processed directly.",
    suggestion:
      'Please export as PDF from AutoCAD: File → Export to DWF/PDF → Select "PDF" → Save. Then upload the PDF here.',
  },
  dxf: {
    fileName: "",
    fileType: "dxf",
    error: "DXF files cannot be processed directly.",
    suggestion:
      'Please export as PDF from your CAD software: File → Export → PDF. Or open in AutoCAD and use File → Export to DWF/PDF → "PDF".',
  },
  ifc: {
    fileName: "",
    fileType: "ifc",
    error: "IFC (BIM) file support is coming soon.",
    suggestion:
      "IFC support is on our Month 2 roadmap. For now, please export floor plans and sections as PDF from your BIM software (Revit: File → Export → PDF).",
  },
  revit: {
    fileName: "",
    fileType: "rvt",
    error: "Revit files cannot be processed directly.",
    suggestion:
      "Please export floor plans and sections as PDF from Revit: File → Export → PDF. Or export schedules as Excel: View → Schedules → Export.",
  },
  "3d": {
    fileName: "",
    fileType: "3d",
    error: "3D model files are not relevant for scheduling.",
    suggestion:
      "For scheduling, we need 2D drawings (PDF), scope of work (Word/PDF), and BOQ (Excel). Please export relevant 2D views as PDF.",
  },
  word_legacy: {
    fileName: "",
    fileType: "doc",
    error: "Legacy .doc format is not supported.",
    suggestion:
      'Please save as .docx format: Open in Word → File → Save As → Select "Word Document (.docx)" → Save. Then upload the .docx file.',
  },
  unknown: {
    fileName: "",
    fileType: "unknown",
    error: "This file type is not supported.",
    suggestion:
      "Supported formats: PDF (drawings), Word .docx (scope of work), Excel .xlsx (BOQ), and images (JPG/PNG). Please convert your file to one of these formats.",
  },
};

// ---------------------------------------------------------------------------
// MAIN PARSE FUNCTION
// ---------------------------------------------------------------------------

/**
 * Parse a single file from a Buffer.
 *
 * Usage in the worker:
 *   const buffer = await fetchFileFromSupabase(document.fileUrl);
 *   const result = await parseFile(buffer, document.fileName);
 *
 *   if (result.success) {
 *     // result.document.contents → send to Claude API
 *   } else {
 *     // result.error.suggestion → show to user
 *   }
 */
export async function parseFile(
  buffer: Buffer,
  fileName: string
): Promise<ParseResult> {
  const fileType = detectFileType(fileName);

  try {
    switch (fileType) {
      case "pdf": {
        const doc = await parsePdf(buffer, fileName);
        return { success: true, document: doc };
      }
      case "excel": {
        const doc = await parseExcel(buffer, fileName);
        return { success: true, document: doc };
      }
      case "word": {
        const doc = await parseWord(buffer, fileName);
        return { success: true, document: doc };
      }
      case "image": {
        const doc = await parseImage(buffer, fileName);
        return { success: true, document: doc };
      }
      case "csv":
      case "tsv": {
        const doc = await parseCsv(buffer, fileName);
        return { success: true, document: doc };
      }

      // Rejected types — return helpful guidance
      case "dwg":
      case "dxf":
      case "ifc":
      case "revit":
      case "3d":
      case "word_legacy": {
        const rejection = { ...REJECTION_MESSAGES[fileType], fileName };
        return { success: false, error: rejection };
      }

      default: {
        const rejection = { ...REJECTION_MESSAGES.unknown, fileName, fileType };
        return { success: false, error: rejection };
      }
    }
  } catch (err: any) {
    console.error(`[parsers] Failed to parse ${fileName}:`, err.message);
    return {
      success: false,
      error: {
        fileName,
        fileType,
        error: `Failed to parse file: ${err.message}`,
        suggestion: "The file may be corrupted or password-protected. Please try re-exporting it.",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// BATCH PARSE — process multiple documents for a project
// ---------------------------------------------------------------------------

export interface BatchParseResult {
  parsed: ParsedDocument[];
  errors: ParseError[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    fileTypes: Record<string, number>;
  };
}

/**
 * Parse multiple files at once. Used when a PM uploads several documents
 * for schedule generation (e.g., 2 PDFs + 1 Word + 1 Excel).
 *
 * Returns all successfully parsed documents + any errors with suggestions.
 * The worker sends parsed docs to Claude and shows errors to the user.
 */
export async function parseFiles(
  files: Array<{ buffer: Buffer; fileName: string }>
): Promise<BatchParseResult> {
  const parsed: ParsedDocument[] = [];
  const errors: ParseError[] = [];
  const fileTypes: Record<string, number> = {};

  // Process files concurrently — they're independent operations
  const results = await Promise.all(
    files.map((f) => parseFile(f.buffer, f.fileName))
  );

  for (const result of results) {
    if (result.success) {
      parsed.push(result.document);
      fileTypes[result.document.fileType] =
        (fileTypes[result.document.fileType] || 0) + 1;
    } else {
      errors.push(result.error);
      fileTypes[result.error.fileType] =
        (fileTypes[result.error.fileType] || 0) + 1;
    }
  }

  return {
    parsed,
    errors,
    summary: {
      total: files.length,
      successful: parsed.length,
      failed: errors.length,
      fileTypes,
    },
  };
}

// ---------------------------------------------------------------------------
// HELPER: Fetch file from URL (Supabase Storage)
// ---------------------------------------------------------------------------

/**
 * Fetch a file from a URL and return its Buffer.
 * Works with Supabase Storage signed URLs and public URLs.
 *
 * Usage:
 *   const buffer = await fetchFileBuffer("https://xxx.supabase.co/storage/v1/...");
 *   const result = await parseFile(buffer, "drawings.pdf");
 */
export async function fetchFileBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch file: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// HELPER: Convert ParsedDocument to Claude API message content blocks
// ---------------------------------------------------------------------------

/**
 * Converts parsed documents into the content array format that
 * the Claude API expects in a message.
 *
 * Usage in the worker:
 *   const content = toClaudeContent(parsedDocs);
 *   const response = await anthropic.messages.create({
 *     messages: [{ role: "user", content }],
 *     ...
 *   });
 */
export function toClaudeContent(
  documents: ParsedDocument[],
  promptText: string
): Array<
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: string; data: string } }
> {
  const content: Array<any> = [];

  // Add each document's content blocks
  for (const doc of documents) {
    // Add a label so Claude knows which file it's looking at
    content.push({
      type: "text" as const,
      text: `--- File: ${doc.fileName} (${doc.fileType}) ---`,
    });

    for (const block of doc.contents) {
      if (block.type === "text" && block.text) {
        content.push({
          type: "text" as const,
          text: block.text,
        });
      } else if (block.type === "image" && block.base64Data && block.mediaType) {
        content.push({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: block.mediaType,
            data: block.base64Data,
          },
        });
      } else if (block.type === "document" && block.base64Data && block.mediaType) {
        content.push({
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: block.mediaType,
            data: block.base64Data,
          },
        });
      }
    }
  }

  // Add the actual prompt at the end (Claude reads documents first, then instructions)
  content.push({
    type: "text" as const,
    text: promptText,
  });

  return content;
}

// ---------------------------------------------------------------------------
// HELPER: Validate file size before parsing
// ---------------------------------------------------------------------------

/** Max file sizes in bytes */
const MAX_FILE_SIZES: Record<string, number> = {
  pdf: 30 * 1024 * 1024,     // 30 MB (Claude limit for documents)
  excel: 10 * 1024 * 1024,   // 10 MB
  word: 10 * 1024 * 1024,    // 10 MB
  image: 20 * 1024 * 1024,   // 20 MB (Claude limit for images)
  csv: 5 * 1024 * 1024,      // 5 MB
  tsv: 5 * 1024 * 1024,      // 5 MB
};

const MAX_IMAGES_PER_REQUEST = 5; // Claude's recommended limit

export function validateFileSize(
  fileName: string,
  sizeBytes: number
): { valid: boolean; error?: string } {
  const fileType = detectFileType(fileName);
  const maxSize = MAX_FILE_SIZES[fileType];

  if (!maxSize) {
    return { valid: true }; // unknown types get rejected at parse time anyway
  }

  if (sizeBytes > maxSize) {
    const maxMb = Math.round(maxSize / (1024 * 1024));
    const actualMb = (sizeBytes / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File "${fileName}" is ${actualMb} MB, which exceeds the ${maxMb} MB limit for ${fileType} files.`,
    };
  }

  return { valid: true };
}

export function validateImageCount(imageCount: number): {
  valid: boolean;
  error?: string;
} {
  if (imageCount > MAX_IMAGES_PER_REQUEST) {
    return {
      valid: false,
      error: `Too many images (${imageCount}). Maximum ${MAX_IMAGES_PER_REQUEST} images per schedule generation request. Please combine drawings into a single PDF.`,
    };
  }
  return { valid: true };
}