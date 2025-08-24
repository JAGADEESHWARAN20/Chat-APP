"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function useActiveUsers(roomId: string | null) {
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const supabase = supabaseBrowser();

  useEffect(() => {
    if (!roomId) return;

    const fetchActiveUsers = async () => {
      // Count only members with "accepted" AND "online" (or active) status
      const { data } = await supabase
        .from("room_members")
        .select("user_id")
        .eq("room_id", roomId)
        .eq("status", "accepted")
        .eq("is_online", true); // <-- requires you to maintain online/offline in DB

      setActiveUsers(data?.length || 0);
    };

    // Initial fetch
    fetchActiveUsers();

    // Subscribe to changes in room_members
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
