"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/database.types";
import debounce from "lodash.debounce";

type TypingPresence = {
  user_id: string;
  is_typing: boolean;
  last_updated: string;
  room_id: string;
};

export function useTypingStatus(roomId: string, userId: string | null) {
  const supabase = createClientComponentClient<Database>();
  const [typingUsers, setTypingUsers] = useState<TypingPresence[]>([]);

  // --- Broadcast typing state ---
  const sendTypingStatus = useCallback(
    async (isTyping: boolean) => {
      if (!userId || !roomId) return;
      await supabase.channel(`room:${roomId}`).send({
        type: "broadcast",
        event: isTyping ? "typing" : "stopped_typing",
        payload: {
          user_id: userId,
          room_id: roomId,
          is_typing: isTyping,
          last_updated: new Date().toISOString(),
        },
      });
    },
    [userId, roomId, supabase]
  );

  // --- Debounced stop typing ---
  const debouncedStopTyping = useMemo(
    () =>
      debounce(() => {
        sendTypingStatus(false);
      }, 2000), // stops after 2s of no typing
    [sendTypingStatus]
  );

  // --- Call this when user types ---
  const startTyping = useCallback(() => {
    sendTypingStatus(true);
    debouncedStopTyping(); // reset stop timer
  }, [sendTypingStatus, debouncedStopTyping]);

  // --- Subscribe to typing events ---
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room:${roomId}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        setTypingUsers((prev) => {
          const filtered = prev.filter((u) => u.user_id !== payload.user_id);
          return [...filtered, payload];
        });
      })
      .on("broadcast", { event: "stopped_typing" }, ({ payload }) => {
        setTypingUsers((prev) =>
          prev.filter((u) => u.user_id !== payload.user_id)
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  return { typingUsers, startTyping };
}
