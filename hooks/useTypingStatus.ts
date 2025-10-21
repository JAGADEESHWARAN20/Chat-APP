// hooks/useTypingStatus.ts
"use client";

import { useEffect, useState, useCallback } from "react";
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

  // No-op if missing required identifiers
  const canOperate = Boolean(roomId);

  // Start typing - writes a row (or upserts)
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

  // Stop typing - sets is_typing false
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

  // Realtime subscription: only realtime, no polling
  useEffect(() => {
    if (!canOperate) {
      setTypingUsers([]);
      return;
    }

    let isActive = true;

    // Helper to set typing users safely (exclude duplicates)
    const upsertTypingRow = (row: TypingRow) => {
      setTypingUsers((prev) => {
        // remove any existing entry for this user
        const filtered = prev.filter((p) => p.user_id !== row.user_id);
        // if is_typing is true, add it; otherwise, just return filtered
        return row.is_typing ? [...filtered, row] : filtered;
      });
    };

    const removeTypingRow = (user_id: string) => {
      setTypingUsers((prev) => prev.filter((p) => p.user_id !== user_id));
    };

    // One-time initial fetch to populate current typers (optional, fast)
    (async () => {
      try {
        const res = await (supabase as any)
          .from("typing_status")
          .select("*")
          .eq("room_id", roomId)
          .eq("is_typing", true);

        const data: TypingRow[] = Array.isArray(res.data) ? res.data : [];

        if (isActive) {
          // Exclude current user's own typing status
          setTypingUsers(data.filter((d) => d.user_id !== userId));
        }
      } catch (err) {
        console.error("[useTypingStatus] initial fetch error:", err);
      }
    })();

    // Subscribe to realtime changes for this room
    const channelName = `room-typing-${roomId}`;
    const channel = (supabase as any)
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_status",
          filter: `room_id=eq.${roomId}`,
        },
        (payload: any) => {
          // payload.eventType: INSERT | UPDATE | DELETE
          // payload.new / payload.old
          try {
            if (payload?.eventType === "INSERT" || payload?.eventType === "UPDATE") {
              const row: TypingRow = payload.new;
              if (!row) return;

              // ignore our own typing events
              if (row.user_id === userId) return;

              upsertTypingRow(row);
            } else if (payload?.eventType === "DELETE") {
              const oldRow: TypingRow = payload.old;
              if (!oldRow) return;
              if (oldRow.user_id === userId) return;
              removeTypingRow(oldRow.user_id);
            }
          } catch (err) {
            console.error("[useTypingStatus] realtime handler error:", err);
          }
        }
      )
      .subscribe((status: any) => {
        // optional: log subscription status
        // console.debug("[useTypingStatus] channel status:", status);
      });

    // Cleanup on unmount or room change
    return () => {
      isActive = false;
      try {
        // remove subscription channel
        (supabase as any).removeChannel(channel);
      } catch (err) {
        // best-effort removal
        console.warn("[useTypingStatus] removeChannel failed:", err);
      }
      // Do not automatically change DB on unmount here — leave to callers to call stopTyping if needed.
    };
  }, [supabase, roomId, userId, canOperate]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
  } as const;
}
