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

export function useTypingStatus(roomId: string, currentUserId: string) {
  const supabase = createClientComponentClient<Database>();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // Memoize the debounced function to prevent recreation on every render
  const debouncedSetTyping = useMemo(() => {
    return debounce(async (isTyping: boolean) => {
      if (!roomId || !currentUserId) return;

      try {
        const channel = supabase.channel(`room:${roomId}`);
        await channel.track({
          user_id: currentUserId,
          is_typing: isTyping,
          room_id: roomId,
          last_updated: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error updating typing status:", error);
      }
    }, 500);
  }, [roomId, currentUserId, supabase]);

  const setIsTyping = useCallback((isTyping: boolean) => {
    debouncedSetTyping(isTyping);
  }, [debouncedSetTyping]);

  useEffect(() => {
    return () => {
      debouncedSetTyping.cancel();
    };
  }, [debouncedSetTyping]);

  useEffect(() => {
    if (!roomId || !currentUserId) return;

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: {
          key: roomId,
        },
      },
    });

    const handlePresenceSync = () => {
      const state = channel.presenceState<TypingPresence>();
      const now = new Date();
      
      const typingUserIds = Object.values(state)
        .flat()
        .filter((presence) => {
          const isRecent = !presence.last_updated || 
            new Date(presence.last_updated) > new Date(now.getTime() - 3000);
          return (
            presence.user_id !== currentUserId &&
            presence.is_typing &&
            isRecent
          );
        })
        .map((presence) => presence.user_id);

      setTypingUsers(typingUserIds);
    };

    const subscription = channel
      .on("presence", { event: "sync" }, handlePresenceSync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUserId,
            is_typing: false,
            room_id: roomId,
            last_updated: new Date().toISOString(),
          });
        }
      });

    return () => {
      subscription.unsubscribe();
      channel.untrack().catch(console.error);
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [roomId, currentUserId, supabase]);

  return {
    typingUsers,
    setIsTyping,
  };
}