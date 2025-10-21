"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/database.types";

type TypingRow = {
  id?: string;
  room_id: string;
  user_id: string;
  is_typing: boolean;
  updated_at: string;
};

export function useTypingStatus(roomId: string, userId: string | null) {
  const supabase = createClientComponentClient<Database>();
  const [typingUsers, setTypingUsers] = useState<TypingRow[]>([]);

  const canOperate = Boolean(roomId && userId);

  // -------------------------------
  // Start typing
  const startTyping = useCallback(async () => {
    if (!canOperate || !userId) return;
    try {
      await (supabase as any)
        .from("typing_status")
        .upsert(
          {
            room_id: roomId,
            user_id: userId,
            is_typing: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "room_id,user_id" }
        );
    } catch (err) {
      console.error("[useTypingStatus] startTyping error:", err);
    }
  }, [supabase, roomId, userId, canOperate]);

  // -------------------------------
  // Stop typing
  const stopTyping = useCallback(async () => {
    if (!canOperate || !userId) return;
    try {
      await (supabase as any)
        .from("typing_status")
        .update({
          is_typing: false,
          updated_at: new Date().toISOString(),
        })
        .eq("room_id", roomId)
        .eq("user_id", userId);
    } catch (err) {
      console.error("[useTypingStatus] stopTyping error:", err);
    }
  }, [supabase, roomId, userId, canOperate]);

  // -------------------------------
  // Debounced typing helper
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const handleTyping = useCallback(() => {
    if (!canOperate) return;

    startTyping();

    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    typingTimeout.current = setTimeout(() => {
      stopTyping();
    }, 2000); // stop typing after 2 seconds of inactivity
  }, [startTyping, stopTyping, canOperate]);

  // -------------------------------
  // Realtime subscription
  useEffect(() => {
    if (!roomId) {
      setTypingUsers([]);
      return;
    }

    let isActive = true;

    const upsertTypingRow = (row: TypingRow) => {
      setTypingUsers((prev) => {
        const filtered = prev.filter((p) => p.user_id !== row.user_id);
        return row.is_typing ? [...filtered, row] : filtered;
      });
    };

    const removeTypingRow = (user_id: string) => {
      setTypingUsers((prev) => prev.filter((p) => p.user_id !== user_id));
    };

    // Initial fetch
    (async () => {
      try {
        const res = await (supabase as any)
          .from("typing_status")
          .select("*")
          .eq("room_id", roomId)
          .eq("is_typing", true);

        const data: TypingRow[] = Array.isArray(res.data) ? res.data : [];
        if (isActive) {
          setTypingUsers(data.filter((d) => d.user_id !== userId));
        }
      } catch (err) {
        console.error("[useTypingStatus] initial fetch error:", err);
      }
    })();

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
          try {
            const row: TypingRow = payload.new;
            if (!row) return;
            if (row.user_id === userId) return;

            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              upsertTypingRow(row);
            } else if (payload.eventType === "DELETE") {
              removeTypingRow(payload.old.user_id);
            }
          } catch (err) {
            console.error("[useTypingStatus] realtime handler error:", err);
          }
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      if ((supabase as any).removeChannel) {
        (supabase as any).removeChannel(channel);
      }
    };
  }, [supabase, roomId, userId]);

  // -------------------------------
  // Display text for UI: "User1 is typing..." or "User1, User2 are typing..."
  const typingDisplayText = typingUsers
    .map((u) => u.user_id) // replace with user name if available
    .join(", ");

  return {
    typingUsers,
    startTyping,
    stopTyping,
    handleTyping, // debounced
    typingDisplayText, // helper for UI
  } as const;
}
