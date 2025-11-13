// app/auth/callback/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // If server route exchanged and redirected to this page with no next,
    // client can safely route to homepage (server route already set cookie).
    // But this is lightweight; server redirect usually sends user off immediately.
    const t = setTimeout(() => router.replace("/"), 1200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <p className="text-white">Signing you in…</p>
      </div>
    </div>
  );
}
