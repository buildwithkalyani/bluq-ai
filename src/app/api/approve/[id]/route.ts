import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") || "";
  const base = process.env.FASTIFY_API_URL || "https://bluq-ai-api-production.up.railway.app";

  const res = await fetch(
    `${base}/demo-requests/${params.id}/approve?secret=${encodeURIComponent(secret)}`,
    { method: "GET" }
  );

  const html = await res.text();
  return new Response(html, {
    status: res.status,
    headers: { "Content-Type": "text/html" },
  });
}
