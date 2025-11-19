// lib/supabase/client.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/supabase";

type SupabaseBrowserClient = ReturnType<typeof createBrowserClient<Database>>;

class SupabaseClient {
  private static instance: SupabaseBrowserClient | null = null;

  private constructor() {}

  public static getInstance(): SupabaseBrowserClient {
    if (this.instance) return this.instance;

    this.instance = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          // critical: don't persist session to localStorage — rely on server cookies
          persistSession: false,
          // detectSessionInUrl: false // optional
        },
      }
    );

    try {
      this.instance.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          SupabaseClient.clearInstance();
        }
      });
    } catch {
      // noop
    }

    return this.instance;
  }

  public static clearInstance() {
    try {
      this.instance?.auth.signOut().catch(() => {});
    } finally {
      this.instance = null;
    }
  }
}

export const getSupabaseBrowserClient = () => SupabaseClient.getInstance();
export const clearSupabaseClient = () => SupabaseClient.clearInstance();

// // lib/supabase/client.ts
// "use client";

// import { createBrowserClient } from "@supabase/ssr";
// import type { Database } from "@/lib/types/supabase";
// import type { SupabaseClient as _SupabaseClient } from "@supabase/supabase-js";

// type SupabaseBrowserClient = ReturnType<typeof createBrowserClient<Database>>;

// /**
//  * Singleton factory for the browser Supabase client.
//  * Important: persistSession: false => rely on HTTP-only cookies set by server flows.
//  */
// class SupabaseClient {
//   private static instance: SupabaseBrowserClient | null = null;

//   private constructor() {}

//   public static getInstance(): SupabaseBrowserClient {
//     if (this.instance) return this.instance;

//     this.instance = createBrowserClient<Database>(
//       process.env.NEXT_PUBLIC_SUPABASE_URL!,
//       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//       {
//         // Critical: don't persist session in localStorage — rely on cookies
//         auth: {
//           persistSession: false,
//           // optionally: detectSessionInUrl: false,
//         },
//       }
//     );

//     try {
//       // keep minimal handler: when user signs out, clear singleton so next call creates a fresh client
//       this.instance.auth.onAuthStateChange((event) => {
//         if (event === "SIGNED_OUT") {
//           // clear client instance to avoid stale state using old tokens
//           SupabaseClient.clearInstance();
//         }
//       });
//     } catch (e) {
//       // ignore if onAuthStateChange isn't available for some reason
//       // console.warn("Supabase onAuthStateChange attach failed", e);
//     }

//     return this.instance;
//   }

//   public static clearInstance() {
//     try {
//       // attempt to sign out and then clear instance reference
//       this.instance?.auth.signOut().catch(() => {});
//     } finally {
//       this.instance = null;
//     }
//   }
// }

// export const getSupabaseBrowserClient = () => SupabaseClient.getInstance();
// export const clearSupabaseClient = () => SupabaseClient.clearInstance();
