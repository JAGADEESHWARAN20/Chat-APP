// lib/supabaseBrowser.ts
import { createBrowserClient } from "@supabase/ssr";
import { Database } from "../types/supabase";

// Ensure environment variables exist
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Check your .env file.");
}

export const supabaseBrowser = () =>
  createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
