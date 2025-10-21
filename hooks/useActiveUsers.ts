"use client";
import { useEffect, useState, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function useActiveUsers(roomId: string | null) {
  const [activeUsers, setActiveUsers] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = useMemo(() => supabaseBrowser(), []);

  // Fetch user ID asynchronously
  useEffect(() => {
    const fetchUserId = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data?.user?.id ?? Math.random().toString(36).substring(2)); // Fallback to random string if no user
    };
    fetchUserId();
  }, [supabase]);

  // Handle presence channel once userId and roomId are ready
  useEffect(() => {
    if (!roomId || !userId) {
      setActiveUsers(0);
      return;
    }

    const channel = supabase.channel(`presence:room-${roomId}`, {
      config: {
        presence: { key: userId }, // Now a string, not a Promise
      },
    });

    // Sync presence state
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const onlineCount = Object.keys(state).length;
      setActiveUsers(onlineCount);
    });

    // Detect joins/leaves
    channel.on("presence", { event: "join" }, () => {
      const state = channel.presenceState();
      setActiveUsers(Object.keys(state).length);
    });

    channel.on("presence", { event: "leave" }, () => {
      const state = channel.presenceState();
      setActiveUsers(Object.keys(state).length);
    });

    // Subscribe and track presence
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: userId, room_id: roomId, online: true });
      }
    });

    // Cleanup
    return () => {
      channel.unsubscribe();
    };
  }, [roomId, userId, supabase]);

  return activeUsers;
}