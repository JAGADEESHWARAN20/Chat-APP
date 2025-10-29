"use client";
import { createBrowserClient } from "@supabase/ssr";
import { Database } from "../types/supabase";

let supabase: ReturnType<typeof createBrowserClient<Database>>;

export const getBrowserSupabaseClient = () => {
  if (!supabase) {
    supabase = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return supabase;
};
