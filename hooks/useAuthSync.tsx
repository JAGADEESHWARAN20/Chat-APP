// hooks/useAuthSync.tsx (your useAuthSync file)
"use client";
import { useEffect, useRef, useMemo } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/store/user";
import { useRoomStore } from "@/lib/store/RoomContext";
// import { AuthApiError } from "@supabase/supabase-js";

export function useAuthSync() {
  const supabase = getSupabaseBrowserClient();
  const { user, setUser } = useUser();
  const setRoomUser = useRoomStore((s) => s.setUser);
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
          setUser(newUser);
          setRoomUser(newUser);
        }
      })
      .catch((err) => {
        // handle refresh-token related failures gracefully
        console.error("getSession error:", err);
        const isAuthError =
          err?.name === "AuthApiError" && err?.code === "refresh_token_not_found";
        if (isAuthError) {
          // Hard sign out to clear any stale client state
          supabase.auth.signOut().catch(() => {});
          setUser(null);
          setRoomUser(null);
        }
      });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      const newUser = session?.user ?? null;
      const userId = newUser?.id ?? null;
      if (lastUserIdRef.current === userId) return;
      lastUserIdRef.current = userId;
      setUser(newUser);
      setRoomUser(newUser);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase, setUser, setRoomUser]);

  const userId = user?.id ?? null;
  const isAuthenticated = Boolean(userId);
  // If user is literally undefined, treat as loading
  const isLoading = user === undefined;

  return useMemo(
    () => ({ user, userId, isAuthenticated, isLoading }),
    [user, userId, isAuthenticated, isLoading]
  );
}
