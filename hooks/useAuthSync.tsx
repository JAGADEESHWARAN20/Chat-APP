"use client";

import { useEffect, useRef, useMemo } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/store/user";
import { useRoomStore } from "@/lib/store/RoomContext";

/**
 * ✅ Unified Auth Hook
 * - Syncs session → Zustand stores (user + room user)
 * - Provides stable derived state:
 *   user, userId, isAuthenticated, isLoading
 */
export function useAuthSync() {
  const supabase = getSupabaseBrowserClient();

  const { user, setUser } = useUser();
  const setRoomUser = useRoomStore((s) => s.setUser);

  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Initial session sync
    supabase.auth.getSession().then(({ data: { session } }) => {
      const newUser = session?.user ?? null;
      const userId = newUser?.id ?? null;

      if (lastUserIdRef.current !== userId) {
        lastUserIdRef.current = userId;
        setUser(newUser);
        setRoomUser(newUser);
      }
    });

    // Listen for auth state changes (ignore unnecessary events)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION") return;

        const newUser = session?.user ?? null;
        const userId = newUser?.id ?? null;

        if (lastUserIdRef.current === userId) return;

        lastUserIdRef.current = userId;
        setUser(newUser);
        setRoomUser(newUser);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, setUser, setRoomUser]);

  /* ✅ Derived values (computed only when needed) */
  const userId = user?.id ?? null;
  const isAuthenticated = Boolean(userId);
  const isLoading = user === undefined; // if undefined → still loading session

  return useMemo(
    () => ({
      user,
      userId,
      isAuthenticated,
      isLoading,
    }),
    [user, userId, isAuthenticated, isLoading]
  );
}
