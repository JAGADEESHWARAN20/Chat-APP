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
  last_activity?: number;
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
  const lastTypingRef = useRef<number>(0);

  const canOperate = Boolean(roomId && currentUserId);

  // --- START TYPING ---
  const startTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    
    const now = Date.now();
    // Prevent sending too many typing events (throttle to 1 second)
    if (now - lastTypingRef.current < 1000) {
      return;
    }
    
    lastTypingRef.current = now;
    
    const payload: TypingUser = {
      user_id: currentUserId!,
      is_typing: true,
      display_name: user?.user_metadata?.display_name,
      username: user?.user_metadata?.username,
      last_activity: now
    };
    
    channelRef.current.send({ type: "broadcast", event: "typing_start", payload });
  }, [canOperate, currentUserId, user, roomId]);

  // --- STOP TYPING ---
  const stopTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    
    const payload = { 
      user_id: currentUserId!, 
      is_typing: false 
    };
    
    channelRef.current.send({ type: "broadcast", event: "typing_stop", payload });
  }, [canOperate, currentUserId, roomId]);

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

  // --- CLEANUP TYPING USERS ---
  const cleanupStaleTypingUsers = useCallback(() => {
    const now = Date.now();
    const STALE_TIMEOUT = 5000; // 5 seconds
    
    setTypingUsers(prev => {
      const activeUsers = prev.filter(user => {
        const isStale = user.last_activity && (now - user.last_activity > STALE_TIMEOUT);
        return !isStale;
      });
      
      return activeUsers;
    });
  }, []);

  // --- SETUP CHANNEL + BROADCAST LISTENERS ---
  useEffect(() => {
    if (!canOperate) {
      setTypingUsers([]);
      return;
    }

    const channel = supabase.channel(`room-typing-${roomId}`, {
      config: {
        broadcast: { self: false } // Don't receive our own broadcasts
      }
    });

    // Typing start listener
    channel
      .on("broadcast", { event: "typing_start" }, ({ payload }: { payload: TypingUser }) => {
        // Ignore self (should be handled by broadcast config, but double-check)
        if (payload.user_id === currentUserId) return;

        setTypingUsers((prev) => {
          const exists = prev.some((u) => u.user_id === payload.user_id);
          if (exists) {
            // Update existing user
            const updated = prev.map(u => 
              u.user_id === payload.user_id 
                ? { ...u, is_typing: true, last_activity: Date.now() }
                : u
            );
            return updated;
          } else {
            // Add new user
            const updated = [...prev, { 
              ...payload, 
              is_typing: true, 
              last_activity: Date.now() 
            }];
            return updated;
          }
        });
      })
      .on("broadcast", { event: "typing_stop" }, ({ payload }: { payload: TypingUser }) => {
        setTypingUsers((prev) => {
          const updated = prev.filter((u) => u.user_id !== payload.user_id);
          return updated;
        });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Send initial stop typing to clear any previous state
          stopTyping();
        }
      });

    channelRef.current = channel;

    // Set up interval to clean up stale typing users
    const cleanupInterval = setInterval(cleanupStaleTypingUsers, 2000);

    return () => {
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Clear interval
      clearInterval(cleanupInterval);
      
      // Stop typing and remove channel
      stopTyping();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      // Clear typing users
      setTypingUsers([]);
    };
  }, [supabase, roomId, currentUserId, canOperate, stopTyping, cleanupStaleTypingUsers]);

  // --- COMPUTE TYPING TEXT ---
  const typingDisplayText = useMemo(() => {
    const active = typingUsers.filter((u) => u.is_typing);
    
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
    
    return text;
  }, [typingUsers]);

  // --- MANUAL STOP TYPING (for external use) ---
  const forceStopTyping = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    stopTyping();
  }, [stopTyping]);

  return {
    typingUsers,
    typingDisplayText,
    startTyping,
    stopTyping,
    handleTyping,
    forceStopTyping,
    canOperate,
    currentRoomId: roomId,
    currentUserId
  } as const;
}