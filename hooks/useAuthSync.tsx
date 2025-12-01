"use client";

import { useEffect, useRef, useMemo } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/store/user";
import { useUnifiedStore } from "@/lib/store/unified-roomstore";

export function useAuthSync() {
  const supabase = getSupabaseBrowserClient();
  const { user, setUser } = useUser();

  // ✅ unified-store only stores userId, not full user
  const setRoomUserId = useUnifiedStore((s) => s.setUserId);

  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;

        const newUser = data.session?.user ?? null;
        const userId = newUser?.id ?? null;

        if (lastUserIdRef.current !== userId) {
          lastUserIdRef.current = userId;

          // Update local user store
          setUser(newUser);

          // Update unified room store with ONLY userId
          setRoomUserId(userId);
        }
      })
      .catch((err) => {
        console.error("getSession error:", err);

        const isAuthError =
          err?.name === "AuthApiError" &&
          err?.code === "refresh_token_not_found";

        if (isAuthError) {
          supabase.auth.signOut().catch(() => {});
          setUser(null);
          setRoomUserId(null);
        }
      });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;

      const newUser = session?.user ?? null;
      const userId = newUser?.id ?? null;

      if (lastUserIdRef.current === userId) return;

      lastUserIdRef.current = userId;

      setUser(newUser);
      setRoomUserId(userId);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase, setUser, setRoomUserId]);

  const userId = user?.id ?? null;
  const isAuthenticated = Boolean(userId);
  const isLoading = user === undefined;

  return useMemo(
    () => ({ user, userId, isAuthenticated, isLoading }),
    [user, userId, isAuthenticated, isLoading]
  );
}
