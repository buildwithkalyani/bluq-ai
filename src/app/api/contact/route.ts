import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const base = process.env.FASTIFY_API_URL || "https://bluq-ai-production-b39b.up.railway.app";
  const res = await fetch(`${base}/demo-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: body.name,
      role: body.role,
      email: body.email,
      companyName: body.company || "unknown",
      message: body.message,
      source: "contact",
    }),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
