"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type TypingUser = {
  user_id: string;
};

export const useRoomPresence = (roomId: string | null) => {
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const supabase = supabaseBrowser();

  useEffect(() => {
    if (!roomId) return;

    const fetchPresence = async () => {
      // ✅ Fetch accepted room members
      const { data: roomMembers } = await supabase
        .from("room_members")
        .select("user_id")
        .eq("room_id", roomId)
        .eq("status", "accepted");

      if (!roomMembers) return;

      const memberIds = roomMembers.map((m) => m.user_id);
      setActiveUsers(memberIds.length);

      // ✅ Fetch typing users
      const { data: presenceData } = await supabase
        .from("typing_status")
        .select("user_id, is_typing")
        .eq("room_id", roomId)
        .eq("is_typing", true)
        .in("user_id", memberIds);

      if (presenceData) {
        setTypingUsers(presenceData);
      }
    };

    fetchPresence();

    const channel = supabase
      .channel(`room-presence-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "typing_status", filter: `room_id=eq.${roomId}` },
        fetchPresence
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        fetchPresence
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, supabase]);

  return { activeUsers, typingUsers };
};
