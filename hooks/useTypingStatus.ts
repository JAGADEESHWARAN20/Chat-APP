// hooks/useTypingStatus.ts - COMPLETE WORKING VERSION
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

const TYPING_TIMEOUT = 3000; // 3 seconds
const TYPING_CHECK_INTERVAL = 1500; // Check every 1.5 seconds
const STALE_THRESHOLD = 5000; // Consider typing stale after 5 seconds

export function useTypingStatus(roomId: string, userId: string | null) {
  const supabase = createClientComponentClient<Database>();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<any>(null);
  const isUserTypingRef = useRef(false);

  // Update typing status in database
  const updateTypingStatus = useCallback(
    async (isTyping: boolean) => {
      if (!userId || !roomId) {
        console.warn("[Typing] Missing userId or roomId", { userId, roomId });
        return;
      }

      try {
        console.log(
          `[Typing] 📤 Updating status: ${isTyping ? "TYPING" : "STOPPED"} for user ${userId} in room ${roomId}`
        );

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
          console.error("[Typing] ❌ Database error:", error);
          return;
        }

        console.log(`[Typing] ✅ Status updated:`, data);
        isUserTypingRef.current = isTyping;
      } catch (error) {
        console.error("[Typing] ❌ Unexpected error updating status:", error);
      }
    },
    [userId, roomId, supabase]
  );

  // Fetch typing users from database
  const fetchTypingUsers = useCallback(async () => {
    if (!roomId) {
      console.warn("[Typing] No roomId for fetch");
      return;
    }

    try {
      console.log(
        `[Typing] 🔍 Fetching typing users for room: ${roomId}`
      );

      // Simply fetch all is_typing = true, no time threshold
      const { data, error } = await (supabase as any)
        .from("typing_status")
        .select("user_id, is_typing, updated_at")
        .eq("room_id", roomId)
        .eq("is_typing", true);

      if (error) {
        console.error("[Typing] ❌ Fetch error:", error);
        return;
      }

      if (data && Array.isArray(data)) {
        console.log(
          `[Typing] 📝 Raw fetch returned ${data.length} records:`,
          data.map((u: any) => ({ id: u.user_id, updated: u.updated_at }))
        );

        // Filter out current user
        const filtered = data.filter((u: any) => u.user_id !== userId);
        
        console.log(
          `[Typing] 📝 After filtering, ${filtered.length} typing users:`,
          filtered.map((u) => u.user_id)
        );

        setTypingUsers(filtered as TypingUser[]);
      } else {
        console.log("[Typing] 📝 No typing users found");
        setTypingUsers([]);
      }
    } catch (error) {
      console.error("[Typing] ❌ Unexpected fetch error:", error);
    }
  }, [roomId, userId]);

  // Debounced stop typing
  const debouncedStopTyping = useMemo(
    () =>
      debounce(() => {
        console.log("[Typing] 🛑 Auto-stopping typing (debounce timeout)");
        updateTypingStatus(false);
      }, TYPING_TIMEOUT),
    [updateTypingStatus]
  );

  // Auto-clean stale typing records periodically
  useEffect(() => {
    const cleanupStaleRecords = async () => {
      try {
        const now = new Date();
        const staleTime = new Date(now.getTime() - STALE_THRESHOLD).toISOString();

        console.log("[Typing] 🧹 Cleaning stale typing records older than:", staleTime);

        await (supabase as any)
          .from("typing_status")
          .update({ is_typing: false })
          .eq("is_typing", true)
          .lt("updated_at", staleTime);
      } catch (error) {
        console.error("[Typing] Error cleaning stale records:", error);
      }
    };

    // Run cleanup every 10 seconds
    const cleanupInterval = setInterval(cleanupStaleRecords, 10000);
    return () => clearInterval(cleanupInterval);
  }, [supabase]);

  // Start typing
  const startTyping = useCallback(() => {
    if (!userId || !roomId) {
      console.warn("[Typing] Cannot start typing: missing userId or roomId");
      return;
    }

    if (!isUserTypingRef.current) {
      console.log("[Typing] ⌨️ User started typing");
      updateTypingStatus(true);
    }

    // Always reset the debounce timer
    debouncedStopTyping();
  }, [updateTypingStatus, debouncedStopTyping, userId, roomId]);

  // Setup: Subscribe to typing_status table changes in this room
  useEffect(() => {
    if (!roomId || !userId) {
      console.warn("[Typing] Setup skipped: missing roomId or userId");
      return;
    }

    console.log("[Typing] 🔔 Setting up typing status for room:", roomId);

    // Initial fetch immediately
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
          console.log("[Typing] 📢 Real-time event received:", {
            eventType: payload.eventType,
            userId: payload.new?.user_id,
            isTyping: payload.new?.is_typing,
          });

          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const record = payload.new as any;

            // Skip current user's own updates
            if (record.user_id === userId) {
              console.log("[Typing] ⏭️ Skipping own typing update");
              return;
            }

            // Handle typing state
            if (record.is_typing) {
              console.log(`[Typing] ➕ User ${record.user_id} is now typing`);

              setTypingUsers((prev) => {
                const exists = prev.find((u) => u.user_id === record.user_id);

                if (exists) {
                  // Update existing user
                  const updated = prev.map((u) =>
                    u.user_id === record.user_id
                      ? {
                          user_id: record.user_id,
                          is_typing: true,
                          updated_at: record.updated_at,
                        }
                      : u
                  );
                  console.log(
                    `[Typing] 🔄 Updated user ${record.user_id}, total typers: ${updated.length}`
                  );
                  return updated;
                } else {
                  // Add new typing user
                  const newList = [
                    ...prev,
                    {
                      user_id: record.user_id,
                      is_typing: true,
                      updated_at: record.updated_at,
                    },
                  ];
                  console.log(
                    `[Typing] ➕ Added new typer ${record.user_id}, total typers: ${newList.length}`
                  );
                  return newList;
                }
              });
            } else {
              // User stopped typing
              console.log(`[Typing] ➖ User ${record.user_id} stopped typing`);

              setTypingUsers((prev) => {
                const filtered = prev.filter(
                  (u) => u.user_id !== record.user_id
                );
                console.log(
                  `[Typing] ➖ Removed ${record.user_id}, total typers: ${filtered.length}`
                );
                return filtered;
              });
            }
          } else if (payload.eventType === "DELETE") {
            const record = payload.old as any;
            console.log(`[Typing] 🗑️ Deleted record for user ${record.user_id}`);

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

    // Polling fallback - refresh every 1.5 seconds
    const pollingInterval = setInterval(() => {
      console.log("[Typing] 🔄 Polling for typing users...");
      fetchTypingUsers();
    }, TYPING_CHECK_INTERVAL);

    return () => {
      console.log("[Typing] 🧹 Cleaning up typing status");

      // Cancel debounce
      debouncedStopTyping.cancel();

      // Unsubscribe from channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      // Clear polling interval
      clearInterval(pollingInterval);

      // Set typing to false when unmounting
      updateTypingStatus(false).catch((err) =>
        console.error("[Typing] Error stopping typing on unmount:", err)
      );
    };
  }, [roomId, userId, supabase, fetchTypingUsers, debouncedStopTyping, updateTypingStatus]);

  return {
    typingUsers,
    startTyping,
  };
}