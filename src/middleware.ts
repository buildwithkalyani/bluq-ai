import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Skip auth in local dev — no database connection required.
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname);

  try {
    // Call Better Auth session endpoint directly to avoid importing `pg` into Edge Runtime.
    const response = await fetch(new URL("/api/auth/get-session", request.url), {
      headers: { cookie: request.headers.get("cookie") || "" },
    });

    // Fail-closed: any non-OK response or missing session → redirect to login
    if (!response.ok) return NextResponse.redirect(loginUrl);

    const session = await response.json();
    if (!session?.user) return NextResponse.redirect(loginUrl);

    return NextResponse.next();
  } catch {
    // Fail-closed: network error or crash → redirect to login, never let through
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding",
    "/projects/:path*",
    "/schedule/:path*",
    "/reports/:path*",
    "/documents/:path*",
    "/settings/:path*",
  ],
};
