"use client";
import { useEffect, useCallback, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/lib/types/supabase";
import { useRoomActions, useSelectedRoom, useTypingUsers, useTypingDisplayText } from "@/lib/store/RoomContext";

// Add missing import for useRoomStore
import { useRoomStore } from '@/lib/store/RoomContext';
interface TypingUser {
  user_id: string;
  is_typing: boolean;
  display_name?: string;
}

export function useTypingStatus() {
  const supabase = createClientComponentClient<Database>();
  const { updateTypingUsers, updateTypingText } = useRoomActions();
  const selectedRoom = useSelectedRoom();
  const typingUsers = useTypingUsers();
  const typingDisplayText = useTypingDisplayText();
  
  const roomId = selectedRoom?.id ?? null;
  const user = useRoomStore((state) => state.user);
  const currentUserId = user?.id ?? null;

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingUsersRef = useRef<TypingUser[]>(typingUsers);

  // Keep ref updated
  useEffect(() => {
    typingUsersRef.current = typingUsers;
  }, [typingUsers]);

  const canOperate = Boolean(roomId && currentUserId);

  const handleTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;

    // Send typing start event
    channelRef.current.send({
      type: "broadcast",
      event: "typing_start",
      payload: { user_id: currentUserId!, is_typing: true },
    });

    // Clear existing timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Set timeout to stop typing
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

  // Generate typing display text
  useEffect(() => {
    const otherTypingUsers = typingUsers.filter(u => u.user_id !== currentUserId);
    
    if (otherTypingUsers.length === 0) {
      updateTypingText("");
      return;
    }

    const names = otherTypingUsers.map(u => u.display_name || `User ${u.user_id.slice(-4)}`);
    
    let displayText = "";
    if (names.length === 1) {
      displayText = `${names[0]} is typing...`;
    } else if (names.length === 2) {
      displayText = `${names[0]} and ${names[1]} are typing...`;
    } else {
      displayText = `${names.length} people are typing...`;
    }
    
    updateTypingText(displayText);
  }, [typingUsers, currentUserId, updateTypingText]);

  // Real-time typing subscription
  useEffect(() => {
    if (!canOperate) {
      updateTypingUsers([]);
      return;
    }

    const channel = supabase.channel(`room-typing-${roomId}`, {
      config: {
        broadcast: { self: false } // Don't receive our own events
      }
    });

    channel
      .on("broadcast", { event: "typing_start" }, ({ payload }) => {
        if (payload.user_id === currentUserId) return;

        const updatedUsers = [...typingUsersRef.current];
        const existingIndex = updatedUsers.findIndex(u => u.user_id === payload.user_id);

        if (existingIndex >= 0) {
          updatedUsers[existingIndex] = { 
            ...updatedUsers[existingIndex], 
            is_typing: true 
          };
        } else {
          updatedUsers.push({
            user_id: payload.user_id,
            is_typing: true,
            display_name: `User ${payload.user_id?.slice(-4)}`,
          });
        }

        updateTypingUsers(updatedUsers);
      })
      .on("broadcast", { event: "typing_stop" }, ({ payload }) => {
        updateTypingUsers(
          typingUsersRef.current.filter(u => u.user_id !== payload.user_id)
        );
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Typing status subscribed to room ${roomId}`);
        }
      });

    channelRef.current = channel;

    return () => {
      stopTyping();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      updateTypingUsers([]);
    };
  }, [supabase, roomId, currentUserId, canOperate, updateTypingUsers, stopTyping]);

  return {
    typingUsers,
    typingDisplayText,
    handleTyping,
    stopTyping,
    canOperate,
  };
}
