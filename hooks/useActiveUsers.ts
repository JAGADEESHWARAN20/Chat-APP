"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function useActiveUsers(roomId: string | null) {
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const supabase = supabaseBrowser();

  useEffect(() => {
    if (!roomId) return;

    const fetchActiveUsers = async () => {
      const { count, error } = await supabase
        .from("room_members")
        .select("*", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("status", "accepted")
        .eq("active", true); // ✅ only count active
      if (error) console.error("Error fetching active users:", error);
      setActiveUsers(count || 0);
    };

    fetchActiveUsers();

    const channel = supabase
      .channel(`room-members-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        fetchActiveUsers
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  return activeUsers;
}
