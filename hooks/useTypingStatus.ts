"use client";

import { useEffect, useCallback, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/lib/types/supabase";
import { useRoomContext } from "@/lib/store/RoomContext";

export function useTypingStatus() {
  const supabase = createClientComponentClient<Database>();
  const { state, updateTypingUsers, updateTypingText } = useRoomContext();
  const { selectedRoom, user, typingUsers } = state;

  const currentUserId = user?.id ?? null;
  const roomId = selectedRoom?.id ?? null;

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const canOperate = Boolean(roomId && currentUserId);

  const handleTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;

    // Send typing start
    const payload = {
      user_id: currentUserId!,
      is_typing: true,
      display_name: user?.user_metadata?.display_name,
      username: user?.user_metadata?.username,
    };
    
    channelRef.current.send({ 
      type: "broadcast", 
      event: "typing_start", 
      payload 
    });

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout to stop typing
    timeoutRef.current = setTimeout(() => {
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "typing_stop",
          payload: { user_id: currentUserId, is_typing: false }
        });
      }
    }, 2000);
  }, [canOperate, currentUserId, user]);

  const stopTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    
    channelRef.current.send({
      type: "broadcast",
      event: "typing_stop",
      payload: { user_id: currentUserId, is_typing: false }
    });
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [canOperate, currentUserId]);

  // Set up channel subscription
  useEffect(() => {
    if (!canOperate) {
      updateTypingUsers([]);
      return;
    }

    const channel = supabase.channel(`room-typing-${roomId}`);

    channel
      .on("broadcast", { event: "typing_start" }, ({ payload }) => {
        if (payload.user_id === currentUserId) return;

        const updatedUsers = [...typingUsers];
        const existingIndex = updatedUsers.findIndex(u => u.user_id === payload.user_id);

        if (existingIndex >= 0) {
          updatedUsers[existingIndex] = { ...updatedUsers[existingIndex], is_typing: true };
        } else {
          updatedUsers.push({ ...payload, is_typing: true });
        }

        updateTypingUsers(updatedUsers);
      })
      .on("broadcast", { event: "typing_stop" }, ({ payload }) => {
        updateTypingUsers(typingUsers.filter(u => u.user_id !== payload.user_id));
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
  }, [supabase, roomId, currentUserId, canOperate, typingUsers, updateTypingUsers, stopTyping]);

  // Update typing display text whenever typing users change
  useEffect(() => {
    const activeTypers = typingUsers.filter(u => u.is_typing);
    
    if (activeTypers.length === 0) {
      updateTypingText("");
      return;
    }

    const names = activeTypers.map(u => u.display_name || u.username || `User ${u.user_id.slice(-4)}`);
    let text = "";

    if (activeTypers.length === 1) {
      text = `${names[0]} is typing...`;
    } else if (activeTypers.length === 2) {
      text = `${names[0]} and ${names[1]} are typing...`;
    } else {
      text = `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]} are typing...`;
    }

    updateTypingText(text);
  }, [typingUsers, updateTypingText]);

  return {
    typingUsers,
    typingDisplayText: state.typingDisplayText,
    handleTyping,
    stopTyping,
    canOperate,
  };
}