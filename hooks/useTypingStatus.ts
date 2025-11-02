"use client";
import { useEffect, useCallback, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/lib/types/supabase";
import { useRoomContext } from "@/lib/store/RoomContext";

export function useTypingStatus() {
  const supabase = createClientComponentClient<Database>();
  const { 
    state, 
    updateTypingUsers, 
    updateTypingText // ✅ NOW AVAILABLE
  } = useRoomContext();
  
  const { selectedRoom, typingUsers, user } = state;
  const roomId = selectedRoom?.id ?? null;
  const currentUserId = user?.id ?? null;

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingUsersRef = useRef(typingUsers);

  // Keep ref updated
  useEffect(() => {
    typingUsersRef.current = typingUsers;
  }, [typingUsers]);

  const canOperate = Boolean(roomId && currentUserId);

  const handleTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;

    channelRef.current.send({
      type: "broadcast",
      event: "typing_start",
      payload: { user_id: currentUserId!, is_typing: true },
    });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "typing_stop",
          payload: { user_id: currentUserId, is_typing: false },
        });
      }
    }, 2000);
  }, [canOperate, currentUserId]);

  const stopTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;

    channelRef.current.send({
      type: "broadcast",
      event: "typing_stop",
      payload: { user_id: currentUserId, is_typing: false },
    });

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [canOperate, currentUserId]);

  // Real-time typing subscription
  useEffect(() => {
    if (!canOperate) {
      updateTypingUsers([]);
      return;
    }

    const channel = supabase.channel(`room-typing-${roomId}`);

    channel
      .on("broadcast", { event: "typing_start" }, ({ payload }) => {
        if (payload.user_id === currentUserId) return;

        const updatedUsers = [...typingUsersRef.current];
        const existingIndex = updatedUsers.findIndex(u => u.user_id === payload.user_id);

        if (existingIndex >= 0) {
          updatedUsers[existingIndex] = { ...updatedUsers[existingIndex], is_typing: true };
        } else {
          updatedUsers.push({
            user_id: payload.user_id,
            is_typing: true,
            display_name: `User ${payload.user_id?.slice(-4)}`, // Fallback name
          });
        }

        updateTypingUsers(updatedUsers);
      })
      .on("broadcast", { event: "typing_stop" }, ({ payload }) => {
        updateTypingUsers(
          typingUsersRef.current.filter(u => u.user_id !== payload.user_id)
        );
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      stopTyping();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      updateTypingUsers([]);
    };
  }, [supabase, roomId, currentUserId, canOperate, updateTypingUsers, stopTyping]);

  return {
    typingUsers,
    typingDisplayText: state.typingDisplayText,
    handleTyping,
    stopTyping,
    canOperate,
  };
}