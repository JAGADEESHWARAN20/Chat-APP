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
  const [channel, setChannel] = useState<any>(null);

  // Memoize debounce function
  const debouncedUpdate = useMemo(() => debounce(async (isTyping: boolean) => {
    if (!roomId || !currentUserId || !channel) return;
    
    try {
      await channel.track({
        user_id: currentUserId,
        is_typing: isTyping,
        room_id: roomId,
        last_updated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error updating typing status:", error);
    }
  }, 500), [roomId, currentUserId, channel]);

  const setIsTyping = useCallback((isTyping: boolean) => {
    debouncedUpdate(isTyping);
  }, [debouncedUpdate]);

  useEffect(() => {
    return () => {
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

  useEffect(() => {
    if (!roomId || !currentUserId) return;

    const newChannel = supabase.channel(`typing_presence:${roomId}`, {
      config: {
        presence: {
          key: roomId,
        },
      },
    });

    const handlePresenceSync = () => {
      const state = newChannel.presenceState<TypingPresence>();
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

    newChannel
      .on("presence", { event: "sync" }, handlePresenceSync)
      .on("presence", { event: "join" }, handlePresenceSync)
      .on("presence", { event: "leave" }, handlePresenceSync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await newChannel.track({
            user_id: currentUserId,
            is_typing: false,
            room_id: roomId,
            last_updated: new Date().toISOString(),
          });
          setChannel(newChannel);
        }
      });

    return () => {
      newChannel.unsubscribe();
      supabase.removeChannel(newChannel);
      setChannel(null);
    };
  }, [roomId, currentUserId, supabase]);

  return {
    typingUsers,
    setIsTyping,
  };
}