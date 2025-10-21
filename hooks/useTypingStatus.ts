// hooks/useTypingStatus.ts - Updated version
"use client";

import { useEffect, useCallback, useRef, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/lib/types/supabase";
import { useRoomContext } from "@/lib/store/RoomContext";

type TypingUser = {
  user_id: string;
  is_typing: boolean;
  display_name?: string;
  username?: string;
};

export function useTypingStatus() {
  const supabase = createClientComponentClient<Database>();
  const { state, updateTypingUsers, updateTypingText } = useRoomContext();
  const { selectedRoom, user, typingUsers } = state;

  const currentUserId = user?.id ?? null;
  const roomId = selectedRoom?.id ?? null;

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const canOperate = Boolean(roomId && currentUserId);

  // --- START TYPING ---
  const startTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    
    console.log("[useTypingStatus] 🔵 START TYPING:", currentUserId);
    
    const payload: TypingUser = {
      user_id: currentUserId!,
      is_typing: true,
      display_name: user?.user_metadata?.display_name,
      username: user?.user_metadata?.username,
    };
    channelRef.current.send({ type: "broadcast", event: "typing_start", payload });
  }, [canOperate, currentUserId, user]);

  // --- STOP TYPING ---
  const stopTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    
    console.log("[useTypingStatus] 🟣 STOP TYPING:", currentUserId);
    
    const payload = { 
      user_id: currentUserId!, 
      is_typing: false 
    };
    channelRef.current.send({ type: "broadcast", event: "typing_stop", payload });
  }, [canOperate, currentUserId]);

  // --- HANDLE TYPING WITH DEBOUNCE ---
  const handleTyping = useCallback(() => {
    if (!canOperate) return;
    
    startTyping();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  }, [startTyping, stopTyping, canOperate]);

  // --- SETUP CHANNEL + BROADCAST LISTENERS ---
  useEffect(() => {
    if (!canOperate) {
      updateTypingUsers([]);
      return;
    }

    console.log("[useTypingStatus] 🚀 Setting up channel for room:", roomId);

    const channel = supabase.channel(`room-typing-${roomId}`);

    channel
      .on("broadcast", { event: "typing_start" }, ({ payload }: { payload: TypingUser }) => {
        console.log("[useTypingStatus] 🟢 RECEIVED typing_start:", payload.user_id);
        
        if (payload.user_id === currentUserId) return;

        const currentTypingUsers = typingUsers;
        const exists = currentTypingUsers.some((u) => u.user_id === payload.user_id);
        
        let updatedUsers: TypingUser[];
        if (exists) {
          updatedUsers = currentTypingUsers.map(u => 
            u.user_id === payload.user_id 
              ? { ...u, is_typing: true }
              : u
          );
        } else {
          updatedUsers = [...currentTypingUsers, { ...payload, is_typing: true }];
        }
        
        updateTypingUsers(updatedUsers);
      })
      .on("broadcast", { event: "typing_stop" }, ({ payload }: { payload: TypingUser }) => {
        console.log("[useTypingStatus] 🛑 RECEIVED typing_stop:", payload.user_id);
        
        const updatedUsers = typingUsers.filter((u) => u.user_id !== payload.user_id);
        updateTypingUsers(updatedUsers);
      })
      .subscribe((status) => {
        console.log(`[useTypingStatus] 📡 Channel status: ${status}`);
      });

    channelRef.current = channel;

    return () => {
      console.log("[useTypingStatus] 🧹 Cleaning up channel");
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      stopTyping();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      updateTypingUsers([]);
    };
  }, [supabase, roomId, currentUserId, canOperate, stopTyping, updateTypingUsers, typingUsers]);

  // --- COMPUTE TYPING TEXT ---
  const typingDisplayText = useMemo(() => {
    const active = typingUsers.filter((u) => u.is_typing);
    
    console.log("[useTypingStatus] 💬 Active typers:", active.length);
    
    if (active.length === 0) return "";
    
    const names = active.map(
      (u) => u.display_name || u.username || `User ${u.user_id.slice(-4)}`
    );
    
    let text = "";
    if (active.length === 1) {
      text = `${names[0]} is typing...`;
    } else if (active.length === 2) {
      text = `${names[0]} and ${names[1]} are typing...`;
    } else {
      text = `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]} are typing...`;
    }
    
    // Update the context with computed text
    updateTypingText(text);
    return text;
  }, [typingUsers, updateTypingText]);

  return {
    typingUsers,
    typingDisplayText,
    startTyping,
    stopTyping,
    handleTyping,
    canOperate,
  } as const;
}