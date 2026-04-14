import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const API_URL = process.env.FASTIFY_API_URL!;

// Use this in Server Components and Server Actions to call the backend API.
// It automatically attaches the current user's session token.
export async function apiRequest(path: string, options: RequestInit = {}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.session.token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || "API request failed");
  }

  return res.json();
}
