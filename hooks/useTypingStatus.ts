"use client";

import { useEffect, useState, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/database.types";

type TypingPresence = {
  user_id: string;
  is_typing: boolean;
};

export function useTypingStatus(roomId: string, currentUserId: string) {
  const supabase = createClientComponentClient<Database>();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const updateTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!roomId || !currentUserId) return;

    const channel = supabase.channel(`room:${roomId}`);
    await channel.track({
      user_id: currentUserId,
      is_typing: isTyping,
      room_id: roomId,
    });
  }, [roomId, currentUserId, supabase]);

  useEffect(() => {
    if (!roomId || !currentUserId) return;

    // Set up the real-time subscription using presence
    const channel = supabase.channel(`room:${roomId}`)
      .on(
        'presence',
        { event: 'sync' },
        () => {
          const state = channel.presenceState<TypingPresence>();
          const typingUserIds = Object.values(state)
            .flat()
            .filter(presence => presence.is_typing && presence.user_id !== currentUserId)
            .map(presence => presence.user_id);
          
          setTypingUsers(typingUserIds);
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUserId,
            is_typing: false,
            room_id: roomId,
          });
        }
      });

    // Cleanup: Remove typing status when unmounting
    return () => {
      updateTypingStatus(false).catch(console.error);
      channel.untrack().catch(console.error);
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [roomId, currentUserId, supabase, updateTypingStatus]);

  return {
    typingUsers,
    setIsTyping: updateTypingStatus,
  };
}