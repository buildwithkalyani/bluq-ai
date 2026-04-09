import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // We use fetch to call the Better Auth endpoint directly. 
  // This prevents importing the `pg` database library into the Edge Runtime.
  const response = await fetch(new URL("/api/auth/get-session", request.url), {
    headers: {
      // Pass the cookie so Better Auth knows who is asking
      cookie: request.headers.get("cookie") || "", 
    },
  });

  const session = await response.json();

  // Better Auth returns a session object if logged in, or null/empty if not
  if (!response.ok || !session || !session.user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

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