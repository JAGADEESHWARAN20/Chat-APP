// hooks/useTypingStatus.ts - FIXED VERSION
"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  const channelRef = useRef<any>(null);

  // Direct database insert/update for typing status (no RPC)
  const updateTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!userId || !roomId) {
      console.warn("Missing userId or roomId", { userId, roomId });
      return;
    }
    
    try {
      console.log(`[Typing] Updating status: ${isTyping} for user ${userId} in room ${roomId}`);
      
      // Cast to any to bypass typing_status not being in Database type
      const { data, error } = await (supabase as any)
        .from("typing_status")
        .upsert(
          {
            user_id: userId,
            room_id: roomId,
            is_typing: isTyping,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,room_id",
          }
        )
        .select();

      if (error) {
        console.error("[Typing] Database error:", error);
        return;
      }

      console.log(`[Typing] ✅ Status updated successfully:`, data);
    } catch (error) {
      console.error("[Typing] Unexpected error:", error);
    }
  }, [userId, roomId, supabase]);

  // Fetch typing users from database
  const fetchTypingUsers = useCallback(async () => {
    if (!roomId) return;
    
    try {
      const now = new Date();
      const fiveSecondsAgo = new Date(now.getTime() - 5000).toISOString();

      const { data, error } = await (supabase as any)
        .from("typing_status")
        .select("user_id, is_typing, updated_at")
        .eq("room_id", roomId)
        .eq("is_typing", true)
        .gt("updated_at", fiveSecondsAgo)
        .neq("user_id", userId);

      if (error) {
        console.error("[Typing] Fetch error:", error);
        return;
      }

      if (data && Array.isArray(data)) {
        console.log("[Typing] 📝 Fetched typing users:", data);
        setTypingUsers(data as TypingUser[]);
      }
    } catch (error) {
      console.error("[Typing] Unexpected fetch error:", error);
    }
  }, [roomId, userId, supabase]);

  // Debounced stop typing
  const debouncedStopTyping = useMemo(
    () =>
      debounce(() => {
        console.log("[Typing] 🛑 Auto-stopping typing");
        updateTypingStatus(false);
      }, 3000),
    [updateTypingStatus]
  );

  // Start typing
  const startTyping = useCallback(() => {
    if (!userId || !roomId) {
      console.warn("[Typing] Cannot start typing: missing userId or roomId");
      return;
    }
    
    console.log("[Typing] ⌨️ User started typing");
    updateTypingStatus(true);
    debouncedStopTyping();
  }, [updateTypingStatus, debouncedStopTyping, userId, roomId]);

  // Setup: Subscribe to typing_status table changes in this room
  useEffect(() => {
    if (!roomId || !userId) {
      console.warn("[Typing] Setup skipped: missing roomId or userId");
      return;
    }

    console.log("[Typing] 🔔 Setting up listeners for room:", roomId);

    // Initial fetch
    fetchTypingUsers();

    // Subscribe to real-time changes in typing_status table
    const channel = (supabase as any)
      .channel(`room-typing-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_status",
          filter: `room_id=eq.${roomId}`,
        },
        (payload: any) => {
          console.log("[Typing] 📢 Real-time event:", payload);

          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const record = payload.new as any;
            
            // Skip current user
            if (record.user_id === userId) {
              console.log("[Typing] Skipping own typing update");
              return;
            }

            // Only show if still typing
            if (record.is_typing) {
              setTypingUsers((prev) => {
                const exists = prev.find((u) => u.user_id === record.user_id);
                if (exists) {
                  // Update existing
                  return prev.map((u) =>
                    u.user_id === record.user_id
                      ? {
                          ...u,
                          is_typing: true,
                          updated_at: record.updated_at,
                        }
                      : u
                  );
                }
                // Add new
                return [
                  ...prev,
                  {
                    user_id: record.user_id,
                    is_typing: true,
                    updated_at: record.updated_at,
                  },
                ];
              });
            }
          } else if (payload.eventType === "DELETE") {
            const record = payload.old as any;
            setTypingUsers((prev) =>
              prev.filter((u) => u.user_id !== record.user_id)
            );
          }
        }
      )
      .subscribe((status: any) => {
        console.log("[Typing] 📡 Subscription status:", status);
      });

    channelRef.current = channel;

    // Polling fallback: refresh every 2 seconds
    const pollingInterval = setInterval(() => {
      console.log("[Typing] 🔄 Polling...");
      fetchTypingUsers();
    }, 2000);

    return () => {
      console.log("[Typing] 🧹 Cleanup");
      debouncedStopTyping.cancel();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      clearInterval(pollingInterval);
      
      // Set is_typing = false when leaving
      updateTypingStatus(false).catch(console.error);
    };
  }, [roomId, userId, supabase, fetchTypingUsers, debouncedStopTyping, updateTypingStatus]);

  return { 
    typingUsers, 
    startTyping 
  };
}