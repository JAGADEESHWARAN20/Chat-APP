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

  // Update typing status in database using RPC functions with type assertions
  const updateTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!userId || !roomId) return;
    
    try {
      // Use RPC with type assertion since the functions exist in database but not in types
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

  // Fetch current typing users from database using RPC
  const fetchTypingUsers = useCallback(async () => {
    if (!roomId) return;
    
    try {
      const { data, error } = await (supabase.rpc as any)('get_typing_users', {
        p_room_id: roomId,
        p_stale_threshold: '3 seconds'
      });

      if (error) {
        console.error("Error fetching typing users:", error);
        return;
      }

      if (data) {
        console.log("📝 Fetched typing users:", data);
        // Filter to only include users who are currently typing
        const activeTypingUsers = data.filter((user: TypingUser) => user.is_typing);
        setTypingUsers(activeTypingUsers);
      }
    } catch (error) {
      console.error("Unexpected error fetching typing users:", error);
    }
  }, [roomId, supabase]);

  // --- Debounced stop typing ---
  const debouncedStopTyping = useMemo(
    () =>
      debounce(() => {
        console.log("🛑 Auto-stopping typing (debounced)");
        updateTypingStatus(false);
      }, 2000),
    [updateTypingStatus]
  );

  // --- Call this when user types ---
  const startTyping = useCallback(() => {
    if (!userId || !roomId) return;
    
    console.log("⌨️ User started typing");
    updateTypingStatus(true);
    debouncedStopTyping(); // reset stop timer
  }, [updateTypingStatus, debouncedStopTyping, userId, roomId]);

  // --- Real-time subscription using broadcast as fallback ---
  useEffect(() => {
    if (!roomId || !userId) return;

    console.log("🔔 Setting up typing status listeners for room:", roomId);

    // Initial fetch
    fetchTypingUsers();

    // Use broadcast channel for real-time updates since we can't subscribe to typing_status table
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
          // Add or update typing user
          setTypingUsers(prev => {
            const filtered = prev.filter(u => u.user_id !== payload.user_id);
            return [...filtered, {
              user_id: payload.user_id,
              is_typing: true,
              updated_at: new Date().toISOString()
            }];
          });

          // Auto-remove after 3 seconds if no further updates
          setTimeout(() => {
            setTypingUsers(prev => 
              prev.filter(u => u.user_id !== payload.user_id || u.updated_at > payload.updated_at)
            );
          }, 3000);
        }
      })
      .on('broadcast', { event: 'user_stopped_typing' }, ({ payload }) => {
        console.log("📢 Received stopped typing broadcast:", payload);
        if (payload.room_id === roomId) {
          setTypingUsers(prev => 
            prev.filter(u => u.user_id !== payload.user_id)
          );
        }
      })
      .subscribe((status) => {
        console.log(`🔔 Typing broadcast channel status:`, status);
      });

    // Polling fallback to sync with database (every 2 seconds)
    const pollingInterval = setInterval(fetchTypingUsers, 2000);

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