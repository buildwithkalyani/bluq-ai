import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const digitsOnly = (body.phone || "").replace(/\D/g, "").slice(-10);
if (body.phone && digitsOnly.length !== 10) {
  return NextResponse.json(
    { error: "Invalid phone number. Must be exactly 10 digits." },
    { status: 400 }
  );
}
  const base = process.env.FASTIFY_API_URL || "https://bluq-ai-api-production.up.railway.app";
  const res = await fetch(`${base}/demo-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
