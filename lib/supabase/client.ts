// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import { Database } from "../types/supabase";

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

// Export a singleton instance or create new instances as needed
export const supabase = createClient();