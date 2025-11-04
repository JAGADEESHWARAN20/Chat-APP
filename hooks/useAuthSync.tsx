"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/store/user";
import { useRoomStore } from "@/lib/store/RoomContext";

export function useAuthSync() {
  const supabase = getSupabaseBrowserClient();
  const { setUser } = useUser();
  const setRoomUser = useRoomStore((s) => s.setUser);

  // ✅ Prevent duplicate processing
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Initial Session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id ?? null;

      if (lastUserIdRef.current !== userId) {
        lastUserIdRef.current = userId;
        setUser(session?.user ?? null);
        setRoomUser(session?.user ?? null);
      }
    });

    // ✅ Stable listener (ignore INITIAL_SESSION)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION") return; // ✅ ignore duplicate event

        const userId = session?.user?.id ?? null;
        if (lastUserIdRef.current === userId) return; // ✅ ignore no-change events
        
        lastUserIdRef.current = userId;
        setUser(session?.user ?? null);
        setRoomUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, setUser, setRoomUser]);
}
