"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function useActiveUsers(roomId: string | null) {
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const supabase = supabaseBrowser();

  useEffect(() => {
    if (!roomId) return;

    const fetchActiveUsers = async () => {
      const { data } = await supabase
        .from("room_members")
        .select("user_id", { count: "exact" })
        .eq("room_id", roomId)
        .eq("status", "accepted");

      if (data) setActiveUsers(data.length);
    };

    // Initial fetch
    fetchActiveUsers();

    // Realtime updates
    const channel = supabase
      .channel(`room-members-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        fetchActiveUsers
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, supabase]);

  return activeUsers;
}
