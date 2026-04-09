// src/app/(auth)/login/page.tsx
import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f0f6ff] to-[#f6f8fa]">
          <div className="text-center text-sm text-[#8C959F]">Loading...</div>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}