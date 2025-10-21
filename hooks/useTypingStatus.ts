// hooks/useTypingStatus.ts (Fixed: Added type assertions for unrecognized table, proper data casting, error handling, and null guards)
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

export function useTypingStatus(roomId: string, userId: string | null | undefined) {
  const supabase = createClientComponentClient<Database>();
  const [typingUsers, setTypingUsers] = useState<TypingRow[]>([]);

  const canOperate = Boolean(roomId && userId);

  // -------------------------------
  // Start typing (Fixed: Type assertion for table)
  const startTyping = useCallback(async () => {
    if (!canOperate || !userId) return;
    try {
      const { error } = await supabase
        .from("typing_status" as any) // TS fix: Assert as any until types regenerate
        .upsert(
          {
            room_id: roomId,
            user_id: userId,
            is_typing: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "room_id,user_id" }
        );
      if (error) throw error;
    } catch (err) {
      console.error("[useTypingStatus] startTyping error:", err);
    }
  }, [supabase, roomId, userId, canOperate]);

  // -------------------------------
  // Stop typing (Fixed: Type assertion for table)
  const stopTyping = useCallback(async () => {
    if (!canOperate || !userId) return;
    try {
      const { error } = await supabase
        .from("typing_status" as any) // TS fix
        .update({
          is_typing: false,
          updated_at: new Date().toISOString(),
        })
        .eq("room_id", roomId)
        .eq("user_id", userId);
      if (error) throw error;
    } catch (err) {
      console.error("[useTypingStatus] stopTyping error:", err);
    }
  }, [supabase, roomId, userId, canOperate]);

  // -------------------------------
  // Debounced typing helper (Improved: Cleanup on unmount)
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const handleTyping = useCallback(() => {
    if (!canOperate) return;

    startTyping();

    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    typingTimeout.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  }, [startTyping, stopTyping, canOperate]);

  useEffect(() => {
    return () => {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
        typingTimeout.current = null;
      }
    };
  }, []);

  // -------------------------------
  // Realtime subscription (Fixed: Type assertion for table in filter, any for payload)
  useEffect(() => {
    if (!roomId) {
      setTypingUsers([]);
      return;
    }

    let isActive = true;

    const upsertTypingRow = (row: TypingRow) => {
      if (!isActive) return;
      setTypingUsers((prev) => {
        const filtered = prev.filter((p) => p.user_id !== row.user_id);
        return row.is_typing ? [...filtered, row] : filtered;
      });
    };

    const removeTypingRow = (user_id: string) => {
      if (!isActive) return;
      setTypingUsers((prev) => prev.filter((p) => p.user_id !== user_id));
    };

    // Initial fetch (Fixed: Type assertion for data)
    (async () => {
      try {
        const { data: res, error } = await supabase
          .from("typing_status" as any) // TS fix
          .select("*")
          .eq("room_id", roomId)
          .eq("is_typing", true);

        if (error) throw error;

        // Fixed: Cast data to TypingRow[] to match type
        const data: TypingRow[] = Array.isArray(res) ? res.map((row: any): TypingRow => ({
          ...row,
          room_id: row.room_id || roomId, // Fallback for safety
          user_id: row.user_id,
          is_typing: row.is_typing ?? false,
          updated_at: row.updated_at || new Date().toISOString(),
        })) : [];
        
        if (isActive && userId) {
          setTypingUsers(data.filter((d) => d.user_id !== userId));
        } else {
          setTypingUsers(data);
        }
      } catch (err) {
        console.error("[useTypingStatus] initial fetch error:", err);
      }
    })();

    const channel = supabase
      .channel(`room-typing-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_status" as any, // TS fix: Assert table
          filter: `room_id=eq.${roomId}`,
        },
        (payload: any) => {
          try {
            const row: TypingRow = {
              ...payload.new,
              room_id: payload.new?.room_id || roomId,
              user_id: payload.new?.user_id,
              is_typing: payload.new?.is_typing ?? false,
              updated_at: payload.new?.updated_at || new Date().toISOString(),
            };
            if (!row || (userId && row.user_id === userId)) return;

            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              upsertTypingRow(row);
            } else if (payload.eventType === "DELETE" && payload.old) {
              removeTypingRow(payload.old.user_id);
            }
          } catch (err) {
            console.error("[useTypingStatus] realtime handler error:", err);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`[useTypingStatus] Subscribed to typing for room ${roomId}`);
        }
      });

    return () => {
      isActive = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, roomId, userId]);

  // -------------------------------
  // Display text (Improved: Exclude self, handle empty)
  const typingDisplayText = typingUsers
    .filter((u) => u.user_id !== userId) // Extra safety filter
    .map((u) => u.user_id) // Later: Map to display_name via profiles
    .join(", ");

  return {
    typingUsers,
    startTyping,
    stopTyping,
    handleTyping,
    typingDisplayText,
  } as const;
}