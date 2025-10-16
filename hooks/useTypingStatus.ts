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

  // Clean up stale typing status
  const cleanupStaleTyping = useCallback(async () => {
    if (!roomId) return;
    
    try {
      // Remove locally stale entries (older than 3 seconds)
      const staleThreshold = new Date(Date.now() - 3000).toISOString();
      setTypingUsers(prev => 
        prev.filter(user => user.last_updated > staleThreshold)
      );
    } catch (error) {
      console.error("Error cleaning up stale typing status:", error);
    }
  }, [roomId]);

  // --- Broadcast typing state ---
  const sendTypingStatus = useCallback(
    async (isTyping: boolean) => {
      if (!userId || !roomId) return;
      
      try {
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
      } catch (error) {
        console.error("Error sending typing status:", error);
      }
    },
    [userId, roomId, supabase]
  );

  // --- Debounced stop typing ---
  const debouncedStopTyping = useMemo(
    () =>
      debounce(() => {
        sendTypingStatus(false);
      }, 2000), // Fixed: 2000ms instead of 20ms
    [sendTypingStatus]
  );

  // --- Call this when user types ---
  const startTyping = useCallback(() => {
    if (!userId || !roomId) return;
    
    sendTypingStatus(true);
    debouncedStopTyping(); // reset stop timer
  }, [sendTypingStatus, debouncedStopTyping, userId, roomId]);

  // --- Subscribe to typing events ---
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-typing-${roomId}`, {
        config: { 
          broadcast: { self: false },
          presence: { key: roomId }
        },
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        console.log("Received typing event:", payload);
        setTypingUsers((prev) => {
          const filtered = prev.filter((u) => u.user_id !== payload.user_id);
          return [...filtered, payload];
        });
      })
      .on("broadcast", { event: "stopped_typing" }, ({ payload }) => {
        console.log("Received stopped_typing event:", payload);
        setTypingUsers((prev) =>
          prev.filter((u) => u.user_id !== payload.user_id)
        );
      })
      .subscribe((status) => {
        console.log(`Typing channel ${roomId} subscription:`, status);
      });

    // Cleanup interval for stale typing status
    const cleanupInterval = setInterval(cleanupStaleTyping, 2000);

    return () => {
      debouncedStopTyping.cancel();
      supabase.removeChannel(channel);
      clearInterval(cleanupInterval);
    };
  }, [roomId, supabase, debouncedStopTyping, cleanupStaleTyping]);

  return { 
    typingUsers, 
    startTyping,
    sendTypingStatus 
  };
}