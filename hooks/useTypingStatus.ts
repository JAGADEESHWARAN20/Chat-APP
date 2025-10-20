"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/database.types";

type TypingUser = {
  user_id: string;
  is_typing: boolean;
  updated_at: string;
};

export function useTypingStatus(roomId: string, userId: string | null) {
  const supabase = createClientComponentClient<Database>();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<any>(null);
  const isUserTypingRef = useRef(false);

  // 🔹 Start or stop typing
  const updateTypingStatus = useCallback(
    async (isTyping: boolean) => {
      if (!userId || !roomId) return;

      try {
        await (supabase as any)
          .from("typing_status")
          .upsert(
            {
              user_id: userId,
              room_id: roomId,
              is_typing: isTyping,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,room_id" }
          );

        isUserTypingRef.current = isTyping;
      } catch (err) {
        console.error("[Typing] update error:", err);
      }
    },
    [userId, roomId, supabase]
  );

  // 🔹 Triggered when the user types
  const startTyping = useCallback(() => {
    if (!userId || !roomId) return;
    if (!isUserTypingRef.current) updateTypingStatus(true);
  }, [userId, roomId, updateTypingStatus]);

  // 🔹 Stop typing
  const stopTyping = useCallback(() => {
    if (!userId || !roomId) return;
    if (isUserTypingRef.current) updateTypingStatus(false);
  }, [userId, roomId, updateTypingStatus]);

  // 🔹 Real-time listener for other users typing
  useEffect(() => {
    if (!roomId || !userId) return;

    console.log("[Typing] 🔔 Realtime listening on room:", roomId);

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
          const record = payload.new || payload.old;
          if (!record || record.user_id === userId) return;

          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            if (record.is_typing) {
              // Add or update
              setTypingUsers((prev) => {
                const exists = prev.find((u) => u.user_id === record.user_id);
                if (exists) {
                  return prev.map((u) =>
                    u.user_id === record.user_id
                      ? { ...u, is_typing: true, updated_at: record.updated_at }
                      : u
                  );
                } else {
                  return [...prev, record];
                }
              });
            } else {
              // Remove user when stopped
              setTypingUsers((prev) =>
                prev.filter((u) => u.user_id !== record.user_id)
              );
            }
          } else if (payload.eventType === "DELETE") {
            setTypingUsers((prev) =>
              prev.filter((u) => u.user_id !== record.user_id)
            );
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      console.log("[Typing] 🧹 Cleanup");
      stopTyping();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [roomId, userId, supabase, stopTyping]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
  };
}
