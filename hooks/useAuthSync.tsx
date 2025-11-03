// lib/hooks/useAuthSync.ts
"use client";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/store/user";

export function useAuthSync() {
  const { setUser, clearUser } = useUser();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const syncUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) await setUser(data.user);
      else clearUser();
    };

    syncUser();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setUser(session.user);
      else clearUser();
    });

    return () => sub.subscription.unsubscribe();
  }, [setUser, clearUser]);
}
