import { NextRequest, NextResponse } from "next/server";

export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/schedule/:path*",
    "/reports/:path*",
    "/documents/:path*",
    "/settings/:path*",
  ],
};