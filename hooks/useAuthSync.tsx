// hooks/useAuthSync.tsx
"use client";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/store/user";

export function useAuthSync() {
  const { setUser, clearUser } = useUser();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let mounted = true;

    const syncUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.error("Auth sync error:", error);
          return;
        }
        
        if (mounted) {
          if (data?.user) {
            await setUser(data.user);
          } else {
            clearUser();
          }
        }
      } catch (error) {
        console.error("Auth sync failed:", error);
        if (mounted) clearUser();
      }
    };

    syncUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      try {
        if (session?.user) {
          await setUser(session.user);
        } else {
          clearUser();
        }
      } catch (error) {
        console.error("Auth state change error:", error);
        clearUser();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setUser, clearUser]);
}