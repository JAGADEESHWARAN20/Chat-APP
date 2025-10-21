// hooks/useTypingStatus.ts
"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/database.types";
import { useRoomContext } from "@/lib/store/RoomContext";

type TypingUser = {
  user_id: string;
  is_typing: boolean;
  display_name?: string;
  username?: string;
};

export function useTypingStatus() {
  const supabase = createClientComponentClient<Database>();
  const { state } = useRoomContext();
  const { selectedRoom, user } = state;

  const currentUserId = user?.id ?? null;
  const roomId = selectedRoom?.id ?? null;

  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const canOperate = Boolean(roomId && currentUserId);

  // --- START TYPING ---
  const startTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    
    const payload: TypingUser = {
      user_id: currentUserId!,
      is_typing: true,
      display_name: user?.user_metadata?.display_name,
      username: user?.user_metadata?.username,
    };
    
    console.log("[useTypingStatus] 🔵 START TYPING:", payload.user_id);
    channelRef.current.send({ type: "broadcast", event: "typing_start", payload });
  }, [canOperate, currentUserId, user]);

  // --- STOP TYPING ---
  const stopTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    
    const payload = { 
      user_id: currentUserId!, 
      is_typing: false 
    };
    
    console.log("[useTypingStatus] 🟣 STOP TYPING:", payload.user_id);
    channelRef.current.send({ type: "broadcast", event: "typing_stop", payload });
  }, [canOperate, currentUserId]);

  // --- HANDLE TYPING WITH DEBOUNCE ---
  const handleTyping = useCallback(() => {
    if (!canOperate) return;
    
    startTyping();
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout to stop typing
    timeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1000);
  }, [startTyping, stopTyping, canOperate]);

  // --- SETUP CHANNEL + BROADCAST LISTENERS ---
  useEffect(() => {
    if (!canOperate) {
      setTypingUsers([]);
      return;
    }

    console.log("[useTypingStatus] 🚀 Setting up channel for room:", roomId);

    const channel = supabase.channel(`room-typing-${roomId}`);

    channel
      .on("broadcast", { event: "typing_start" }, ({ payload }: { payload: TypingUser }) => {
        console.log("[useTypingStatus] 🟢 RECEIVED typing_start:", payload.user_id);
        
        // Ignore self
        if (payload.user_id === currentUserId) return;

        setTypingUsers((prev) => {
          const exists = prev.some((u) => u.user_id === payload.user_id);
          if (exists) {
            return prev.map(u => 
              u.user_id === payload.user_id 
                ? { ...u, is_typing: true }
                : u
            );
          } else {
            return [...prev, { ...payload, is_typing: true }];
          }
        });
      })
      .on("broadcast", { event: "typing_stop" }, ({ payload }: { payload: TypingUser }) => {
        console.log("[useTypingStatus] 🛑 RECEIVED typing_stop:", payload.user_id);
        
        setTypingUsers((prev) => {
          return prev.filter((u) => u.user_id !== payload.user_id);
        });
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
      
      setTypingUsers([]);
    };
  }, [supabase, roomId, currentUserId, canOperate, stopTyping]);

  // --- COMPUTE TYPING TEXT ---
  const typingDisplayText = useMemo(() => {
    const active = typingUsers.filter((u) => u.is_typing);
    
    console.log("[useTypingStatus] 💬 Active typers:", active.length);
    
    if (active.length === 0) return "";
    
    const names = active.map(
      (u) => u.display_name || u.username || `User ${u.user_id.slice(-4)}`
    );
    
    if (active.length === 1) {
      return `${names[0]} is typing...`;
    } else if (active.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    } else {
      return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]} are typing...`;
    }
  }, [typingUsers]);

  return {
    typingUsers,
    typingDisplayText,
    startTyping,
    stopTyping,
    handleTyping,
    canOperate,
  } as const;
}