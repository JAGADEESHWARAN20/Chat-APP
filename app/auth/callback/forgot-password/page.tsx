// app/auth/forgot-password/page.tsx
"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/lib/types/supabase";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent (check inbox).");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <form onSubmit={handle} className="bg-black/30 p-6 rounded">
        <h2 className="text-white mb-4">Reset password</h2>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="p-2 rounded bg-white/5 text-white w-72"
        />
        <button className="ml-3 px-3 py-2 bg-blue-600 rounded text-white">Send</button>
      </form>
    </div>
  );
}
