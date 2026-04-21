// Upload to private Supabase Storage bucket via backend-generated signed URL.
// Backend generates the signed upload URL using service role key — no Supabase
// credentials needed on the frontend.

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

export async function uploadFileToStorage(
  file: File,
  projectId: string,
  workspaceId: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  if (!BACKEND_URL) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL not set");
  }

  onProgress?.(10);

  // Step 1: get signed upload URL from backend
  const params = new URLSearchParams({ fileName: file.name, workspaceId, projectId });
  const urlRes = await fetch(`${BACKEND_URL}/documents/upload-url?${params}`);
  if (!urlRes.ok) {
    const body = await urlRes.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Failed to get upload URL");
  }
  const { signedUrl, storagePath } = await urlRes.json() as {
    signedUrl: string;
    storagePath: string;
  };

  onProgress?.(30);

  // Step 2: PUT file directly to Supabase using signed URL
  const uploadRes = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

  if (!uploadRes.ok) {
    const body = await uploadRes.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Upload failed: ${uploadRes.status}`);
  }

  onProgress?.(100);

  // Return storage path — stored in DB, converted to signed URL by worker on demand
  return storagePath;
}
