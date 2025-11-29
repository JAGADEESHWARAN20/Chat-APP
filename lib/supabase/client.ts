// lib/supabase/client.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/supabase";

export const getSupabaseBrowserClient = () => 
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  