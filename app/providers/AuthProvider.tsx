"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/store/user";
import { useUnifiedStore } from "@/lib/store/unified-roomstore";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseBrowserClient();

  const setUser = useUser((s) => s.setUser);
  const clearUser = useUser((s) => s.clearUser);

  // ✅ Correct Zustand selector
  const setRoomUserId = useUnifiedStore((s) => s.setUserId);

  useEffect(() => {
    const sync = async () => {
      const { data } = await supabase.auth.getUser();

      if (data?.user?.id) {
        setUser(data.user);
        setRoomUserId(data.user.id);
      } else {
        clearUser();
        setRoomUserId(null);
      }
    };

    sync();

    // AUTH LISTENER
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user) {
        setUser(session.user);
        setRoomUserId(session.user.id);
      } else {
        clearUser();
        setRoomUserId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, clearUser, setRoomUserId, supabase.auth]);

  return <>{children}</>;
}
