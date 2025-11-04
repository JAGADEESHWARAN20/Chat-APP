// lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/supabase";

export function supabaseServer() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!, // ✅ NOT SERVICE ROLE KEY here
    {
      cookies: {
        get(name) {
          return cookies().get(name)?.value;
        },
        set(name, value, options) {
          try {
            cookies().set(name, value, options);
          } catch {}
        },
        remove(name, options) {
          try {
            cookies().set(name, "", options);
          } catch {}
        }
      }
    }
  );
}
