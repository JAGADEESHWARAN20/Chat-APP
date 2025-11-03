// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/lib/types/supabase'

class SupabaseClient {
  private static instance: ReturnType<typeof createBrowserClient<Database>> | null = null

  private constructor() {}

  public static getInstance() {
    if (!this.instance) {
      this.instance = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }
    return this.instance
  }

  public static clearInstance() {
    this.instance = null
  }
}

export const getSupabaseBrowserClient = () => SupabaseClient.getInstance()