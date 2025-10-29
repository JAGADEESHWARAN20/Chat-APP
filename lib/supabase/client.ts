import { createBrowserClient } from '@supabase/ssr'

class SupabaseClient {
  private static instance: ReturnType<typeof createBrowserClient> | null = null

  private constructor() {}

  public static getInstance() {
    if (!this.instance) {
      this.instance = createBrowserClient(
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