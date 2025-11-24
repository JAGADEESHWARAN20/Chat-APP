"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUnifiedRoomStore } from "@/lib/store/roomstore";

export function useRoomPresenceSync(roomId: string | null, userId: string | null) {
  const supabase = getSupabaseBrowserClient();
  const setRoomPresence = useUnifiedRoomStore((s) => s.setRoomPresence);

  useEffect(() => {
    if (!roomId || !userId) return;

    const channel = supabase.channel(`presence-room-${roomId}`, {
      config: {
        presence: { key: userId },
      },
    });

    channel.track({
      user_id: userId,
      room_id: roomId,
      active_at: new Date().toISOString(),
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const userIds = Object.keys(state);

      setRoomPresence(roomId, {
        onlineUsers: userIds.length,
        userIds,
        lastUpdated: new Date().toISOString(),
      });
    });

    channel.subscribe();

    // 🔥 FIX: cleanup returns void, not a Promise
    return () => {
      supabase.removeChannel(channel); // we don't return the promise
    };
  }, [roomId, userId, supabase, setRoomPresence]);
}
