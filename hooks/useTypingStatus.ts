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

  // Get user ID from RoomContext - this should be the authenticated user
  const currentUserId = user?.id ?? null;
  const roomId = selectedRoom?.id ?? null;

  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<number>(0);

  const canOperate = Boolean(roomId && currentUserId);

  // Debug current state - VERIFY RoomContext user is available
  useEffect(() => {
    console.log("[useTypingStatus] 🔄 State Update:", {
      roomId,
      currentUserId,
      hasRoomContextUser: !!user,
      userFromRoomContext: user ? {
        id: user.id,
        email: user.email,
        username: user.user_metadata?.username,
        display_name: user.user_metadata?.display_name
      } : null,
      canOperate,
      typingUsersCount: typingUsers.length,
      typingUsers: typingUsers.map(u => ({
        user_id: u.user_id,
        username: u.username,
        display_name: u.display_name,
        is_typing: u.is_typing
      }))
    });
  }, [roomId, currentUserId, user, canOperate, typingUsers]);

  // --- START TYPING ---
  const startTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) {
      console.log("[useTypingStatus] ❌ Cannot start typing - missing requirements:", {
        canOperate,
        hasChannel: !!channelRef.current,
        roomId,
        currentUserId,
        hasUser: !!user
      });
      return;
    }
    
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
    
    console.log("[useTypingStatus] 🔵 START TYPING broadcast:", {
      ...payload,
      roomId,
      channel: `room-typing-${roomId}`,
      userVerified: !!user
    });
    
    channelRef.current.send({ type: "broadcast", event: "typing_start", payload });
  }, [canOperate, currentUserId, user, roomId]);

  // --- STOP TYPING ---
  const stopTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) {
      console.log("[useTypingStatus] ❌ Cannot stop typing - missing requirements:", {
        canOperate,
        hasChannel: !!channelRef.current,
        currentUserId,
        roomId
      });
      return;
    }
    
    const payload = { 
      user_id: currentUserId!, 
      is_typing: false 
    };
    
    console.log("[useTypingStatus] 🟣 STOP TYPING broadcast:", {
      ...payload,
      roomId,
      userVerified: !!user
    });
    
    channelRef.current.send({ type: "broadcast", event: "typing_stop", payload });
  }, [canOperate, currentUserId, roomId, user]);

  // --- HANDLE TYPING WITH DEBOUNCE ---
  const handleTyping = useCallback(() => {
    console.log("[useTypingStatus] ⌨️  Handle typing called", {
      canOperate,
      currentUserId,
      roomId,
      hasUser: !!user
    });
    
    if (!canOperate) {
      console.log("[useTypingStatus] ❌ Cannot handle typing - missing room or user");
      return;
    }
    
    startTyping();
    
    // Clear existing timeout
    if (timeoutRef.current) {
      console.log("[useTypingStatus] ⏰ Clearing existing timeout");
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout to stop typing
    timeoutRef.current = setTimeout(() => {
      console.log("[useTypingStatus] ⏰ Timeout reached - stopping typing");
      stopTyping();
    }, 1000);
    
    console.log("[useTypingStatus] ⏰ Set timeout for stop typing in 1000ms");
  }, [startTyping, stopTyping, canOperate]);

  // --- CLEANUP TYPING USERS ---
  const cleanupStaleTypingUsers = useCallback(() => {
    const now = Date.now();
    const STALE_TIMEOUT = 5000; // 5 seconds
    
    setTypingUsers(prev => {
      const activeUsers = prev.filter(user => {
        const isStale = user.last_activity && (now - user.last_activity > STALE_TIMEOUT);
        if (isStale) {
          console.log("[useTypingStatus] 🧹 Removing stale typing user:", user.user_id);
        }
        return !isStale;
      });
      
      if (activeUsers.length !== prev.length) {
        console.log("[useTypingStatus] 🧹 Cleaned typing users:", {
          before: prev.length,
          after: activeUsers.length,
          removed: prev.length - activeUsers.length
        });
      }
      
      return activeUsers;
    });
  }, []);

  // --- SETUP CHANNEL + BROADCAST LISTENERS ---
  useEffect(() => {
    console.log("[useTypingStatus] 🚀 Setting up typing channel:", {
      roomId,
      currentUserId,
      canOperate,
      hasRoomContextUser: !!user,
      userDetails: user ? {
        id: user.id,
        email: user.email
      } : null
    });

    if (!canOperate) {
      console.log("[useTypingStatus] ❌ Cannot setup channel - missing requirements:", {
        hasRoomId: !!roomId,
        hasUserId: !!currentUserId,
        hasUserObject: !!user
      });
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
        console.log("[useTypingStatus] 🟢 RECEIVED typing_start:", {
          payload,
          currentUserId,
          isSelf: payload.user_id === currentUserId,
          roomId
        });

        // Ignore self (should be handled by broadcast config, but double-check)
        if (payload.user_id === currentUserId) {
          console.log("[useTypingStatus] 👻 Ignoring self typing event");
          return;
        }

        setTypingUsers((prev) => {
          const exists = prev.some((u) => u.user_id === payload.user_id);
          if (exists) {
            // Update existing user
            const updated = prev.map(u => 
              u.user_id === payload.user_id 
                ? { ...u, is_typing: true, last_activity: Date.now() }
                : u
            );
            console.log("[useTypingStatus] 🔄 Updated existing typing user:", payload.user_id);
            return updated;
          } else {
            // Add new user
            const updated = [...prev, { 
              ...payload, 
              is_typing: true, 
              last_activity: Date.now() 
            }];
            console.log("[useTypingStatus] ➕ Added new typing user:", {
              user_id: payload.user_id,
              display_name: payload.display_name,
              username: payload.username,
              totalTypingUsers: updated.length,
              roomId
            });
            return updated;
          }
        });
      })
      .on("broadcast", { event: "typing_stop" }, ({ payload }: { payload: TypingUser }) => {
        console.log("[useTypingStatus] 🛑 RECEIVED typing_stop:", {
          payload,
          currentUserId,
          isSelf: payload.user_id === currentUserId,
          roomId
        });

        setTypingUsers((prev) => {
          const updated = prev.filter((u) => u.user_id !== payload.user_id);
          if (updated.length !== prev.length) {
            console.log("[useTypingStatus] ➖ Removed typing user:", {
              user_id: payload.user_id,
              totalTypingUsers: updated.length,
              roomId
            });
          }
          return updated;
        });
      })
      .subscribe((status) => {
        console.log(`[useTypingStatus] 📡 Channel status: ${status}`, {
          roomId,
          currentUserId,
          channel: `room-typing-${roomId}`,
          hasUser: !!user
        });
        
        if (status === "SUBSCRIBED") {
          console.log("[useTypingStatus] ✅ Channel subscribed successfully");
          // Send initial stop typing to clear any previous state
          stopTyping();
        } else if (status === "CHANNEL_ERROR") {
          console.error("[useTypingStatus] ❌ Channel subscription error");
        } else if (status === "TIMED_OUT") {
          console.error("[useTypingStatus] ❌ Channel timed out");
        }
      });

    channelRef.current = channel;

    // Set up interval to clean up stale typing users
    const cleanupInterval = setInterval(cleanupStaleTypingUsers, 2000);

    return () => {
      console.log("[useTypingStatus] 🧹 Cleaning up typing channel:", {
        roomId,
        currentUserId,
        hasUser: !!user
      });
      
      // Clear timeout
      if (timeoutRef.current) {
        console.log("[useTypingStatus] ⏰ Clearing typing timeout");
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Clear interval
      clearInterval(cleanupInterval);
      
      // Stop typing and remove channel
      stopTyping();
      if (channelRef.current) {
        console.log("[useTypingStatus] 🗑️  Removing channel");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      // Clear typing users
      setTypingUsers([]);
    };
  }, [supabase, roomId, currentUserId, canOperate, stopTyping, cleanupStaleTypingUsers, user]);

  // --- COMPUTE TYPING TEXT ---
  const typingDisplayText = useMemo(() => {
    const active = typingUsers.filter((u) => u.is_typing);
    
    console.log("[useTypingStatus] 💬 Computing display text:", {
      activeUsers: active.length,
      allUsers: typingUsers.length,
      currentUserId,
      roomId,
      activeUserDetails: active.map(u => ({
        user_id: u.user_id,
        display_name: u.display_name,
        username: u.username
      }))
    });
    
    if (active.length === 0) {
      console.log("[useTypingStatus] 💬 No active typing users");
      return "";
    }
    
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
    
    console.log("[useTypingStatus] 💬 Final display text:", text);
    return text;
  }, [typingUsers, currentUserId, roomId]);

  // --- MANUAL STOP TYPING (for external use) ---
  const forceStopTyping = useCallback(() => {
    console.log("[useTypingStatus] 🛑 Force stop typing called", {
      currentUserId,
      roomId
    });
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    stopTyping();
  }, [stopTyping, currentUserId, roomId]);

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