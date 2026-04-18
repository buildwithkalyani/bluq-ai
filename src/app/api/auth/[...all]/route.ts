import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest } from "next/server";

const handler = toNextJsHandler(auth);

export async function GET(req: NextRequest) {
  console.log("[auth] GET", req.nextUrl.pathname, req.nextUrl.search);
  return handler.GET(req);
}

export async function POST(req: NextRequest) {
  console.log("[auth] POST", req.nextUrl.pathname);
  return handler.POST(req);
}