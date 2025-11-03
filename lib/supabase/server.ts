// lib/supabase/server.ts
"use server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "../types/supabase";

let serverClient: ReturnType<typeof createServerClient<Database>> | null = null;

export const supabaseServer = async () => {
  if (serverClient) return serverClient;
  const cookieStore = await cookies();

  serverClient = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
      },
    }
  );
  return serverClient;
};
