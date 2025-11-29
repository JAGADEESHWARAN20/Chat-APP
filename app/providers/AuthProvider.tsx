"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/store/user";
import { useUnifiedRoomStore } from "@/lib/store/roomstore";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const setUser = useUser((s) => s.setUser);
  const clearUser = useUser((s) => s.clearUser);

  const setRoomUser = useUnifiedRoomStore((s) => s.setUser);

  useEffect(() => {
    const sync = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) {
        setUser(data.user);
        setRoomUser({ id: data.user.id });
      } else {
        clearUser();
        setRoomUser(null);
      }
    };

    sync();

    const { data } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user) {
        setUser(session.user);
        setRoomUser({ id: session.user.id });
      } else {
        clearUser();
        setRoomUser(null);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
