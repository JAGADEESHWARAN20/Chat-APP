// hooks/useTypingStatus.ts - FIXED VERSION
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/database.types";
import debounce from "lodash.debounce";

type TypingUser = {
  user_id: string;
  is_typing: boolean;
  updated_at: string;
};

export function useTypingStatus(roomId: string, userId: string | null) {
  const supabase = createClientComponentClient<Database>();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isSetup, setIsSetup] = useState(false);

  // Update typing status in database using RPC
  const updateTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!userId || !roomId) return;
    
    try {
      const { error } = await (supabase.rpc as any)('upsert_typing_status', {
        p_room_id: roomId,
        p_user_id: userId,
        p_is_typing: isTyping
      });

      if (error) {
        console.error("Error updating typing status:", error);
      } else {
        console.log(`✅ Typing status updated: ${isTyping} for user ${userId}`);
      }
    } catch (error) {
      console.error("Unexpected error updating typing status:", error);
    }
  }, [userId, roomId, supabase]);

  // Fetch current typing users from database
  const fetchTypingUsers = useCallback(async () => {
    if (!roomId) return;
    
    try {
      const { data, error } = await (supabase.rpc as any)('get_typing_users', {
        p_room_id: roomId,
        p_stale_threshold: '5 seconds'
      });

      if (error) {
        console.error("Error fetching typing users:", error);
        return;
      }

      if (data && Array.isArray(data)) {
        console.log("📝 Fetched typing users:", data);
        const activeTypingUsers = data.filter((user: TypingUser) => user.is_typing && user.user_id !== userId);
        setTypingUsers(activeTypingUsers);
      }
    } catch (error) {
      console.error("Unexpected error fetching typing users:", error);
    }
  }, [roomId, userId, supabase]);

  // Debounced stop typing
  const debouncedStopTyping = useMemo(
    () =>
      debounce(() => {
        console.log("🛑 Auto-stopping typing (debounced)");
        updateTypingStatus(false);
      }, 3000),
    [updateTypingStatus]
  );

  // Start typing handler
  const startTyping = useCallback(() => {
    if (!userId || !roomId) return;
    
    console.log("⌨️ User started typing");
    updateTypingStatus(true);
    debouncedStopTyping(); // reset stop timer
  }, [updateTypingStatus, debouncedStopTyping, userId, roomId]);

  // Setup subscriptions and polling
  useEffect(() => {
    if (!roomId || !userId) return;

    console.log("🔔 Setting up typing status listeners for room:", roomId);

    // Initial fetch
    fetchTypingUsers();
    
    setIsSetup(true);

    // Use broadcast channel for real-time updates
    const channel = supabase.channel(`typing-broadcast-${roomId}`, {
      config: {
        broadcast: { self: false }
      }
    });

    // Listen for typing events from other users
    channel
      .on('broadcast', { event: 'user_typing' }, ({ payload }) => {
        console.log("📢 Received typing broadcast:", payload);
        if (payload.room_id === roomId && payload.user_id !== userId) {
          setTypingUsers(prev => {
            const exists = prev.find(u => u.user_id === payload.user_id);
            if (exists) {
              return prev.map(u => 
                u.user_id === payload.user_id 
                  ? { ...u, updated_at: new Date().toISOString() }
                  : u
              );
            }
            return [...prev, {
              user_id: payload.user_id,
              is_typing: true,
              updated_at: new Date().toISOString()
            }];
          });
        }
      })
      .on('broadcast', { event: 'user_stopped_typing' }, ({ payload }) => {
        console.log("📢 Received stopped typing broadcast:", payload);
        if (payload.room_id === roomId && payload.user_id !== userId) {
          setTypingUsers(prev => 
            prev.filter(u => u.user_id !== payload.user_id)
          );
        }
      })
      .subscribe((status) => {
        console.log(`🔔 Typing broadcast channel status:`, status);
      });

    // Polling to sync with database (every 3 seconds)
    const pollingInterval = setInterval(fetchTypingUsers, 3000);

    return () => {
      console.log("🧹 Cleaning up typing status listeners");
      debouncedStopTyping.cancel();
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
      
      // Clean up user's typing status when leaving
      updateTypingStatus(false).catch(console.error);
    };
  }, [roomId, userId, supabase, fetchTypingUsers, debouncedStopTyping, updateTypingStatus]);

  return { 
    typingUsers, 
    startTyping 
  };
}