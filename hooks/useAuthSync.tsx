"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/store/user";
import { useRoomStore } from "@/lib/store/RoomContext";

/**
 * Hook to sync authentication state with both user store and room store
 * This ensures all stores stay in sync when user logs in/out
 */
export function useAuthSync() {
  const supabase = getSupabaseBrowserClient();
  const { user: userStoreUser, setUser: setUserStoreUser } = useUser();
  const setRoomUser = useRoomStore((state) => state.setUser);

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Sync to both stores
        setUserStoreUser(session.user);
        setRoomUser(session.user);
        
        console.log("✅ Auth synced to stores:", session.user.email);
      } else {
        // Clear both stores on logout
        setUserStoreUser(null);
        setRoomUser(null);
        
        console.log("🔓 User logged out, stores cleared");
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔄 Auth state changed:", event);
        
        if (session?.user) {
          // Sync to both stores
          setUserStoreUser(session.user);
          setRoomUser(session.user);
          
          console.log("✅ Auth synced to stores:", session.user.email);
        } else {
          // Clear both stores
          setUserStoreUser(null);
          setRoomUser(null);
          
          console.log("🔓 Stores cleared");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, setUserStoreUser, setRoomUser]);

  return { user: userStoreUser };
}