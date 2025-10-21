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

interface UseTypingStatusProps {
  roomId: string;
  userId: string | null | undefined;
  showSelfIndicator?: boolean;
}

export function useTypingStatus({ roomId, userId, showSelfIndicator = false }: UseTypingStatusProps) {
  const supabase = createClientComponentClient<Database>();
  const [typingUsers, setTypingUsers] = useState<TypingRow[]>([]);
  const [isCurrentlyTyping, setIsCurrentlyTyping] = useState(false);
  const [subStatus, setSubStatus] = useState<'initial' | 'subscribed' | 'error'>('initial');
  const fetchRef = useRef(false);

  const canOperate = Boolean(roomId && userId);

  const startTyping = useCallback(async () => {
    if (!canOperate || !userId || isCurrentlyTyping) {
      console.log("[useTypingStatus] startTyping skipped");
      return;
    }
    try {
      setIsCurrentlyTyping(true);
      const { error } = await supabase
        .from("typing_status" as any)
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
      console.log("[useTypingStatus] ✅ startTyping at", new Date().toISOString());
    } catch (err) {
      console.error("[useTypingStatus] startTyping error:", err);
      setIsCurrentlyTyping(false);
    }
  }, [supabase, roomId, userId, canOperate, isCurrentlyTyping]);

  const stopTyping = useCallback(async () => {
    if (!canOperate || !userId) {
      setIsCurrentlyTyping(false);
      return;
    }
    try {
      const { error } = await supabase
        .from("typing_status" as any)
        .update({
          is_typing: false,
          updated_at: new Date().toISOString(),
        })
        .eq("room_id", roomId)
        .eq("user_id", userId);
      if (error) throw error;
      console.log("[useTypingStatus] ✅ stopTyping at", new Date().toISOString());
    } catch (err) {
      console.error("[useTypingStatus] stopTyping error:", err);
    } finally {
      setIsCurrentlyTyping(false);
    }
  }, [supabase, roomId, userId, canOperate]);

  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const handleTyping = useCallback(() => {
    if (!canOperate) return;
    startTyping();
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => stopTyping(), 3000); // FIXED: 3s delay for visibility
  }, [startTyping, stopTyping, canOperate]);

  useEffect(() => {
    return () => {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
        typingTimeout.current = null;
      }
      if (isCurrentlyTyping) stopTyping();
    };
  }, [stopTyping, isCurrentlyTyping]);

  useEffect(() => {
    if (!roomId) {
      setTypingUsers([]);
      setSubStatus('initial');
      return;
    }

    let isActive = true;
    let retryCount = 0;
    const maxRetries = 1;

    const upsertTypingRow = (row: TypingRow) => {
      if (!isActive) return;
      console.log("[useTypingStatus] Raw row before upsert:", { ...row, is_typing: row.is_typing }); // NEW: Log is_typing
      setTypingUsers((prev) => {
        const filtered = prev.filter((p) => p.user_id !== row.user_id);
        return row.is_typing ? [...filtered, row] : filtered;
      });
      console.log(`[useTypingStatus] Upserted ${row.user_id} (is_typing: ${row.is_typing})`);
    };

    const removeTypingRow = (user_id: string) => {
      if (!isActive) return;
      setTypingUsers((prev) => prev.filter((p) => p.user_id !== user_id));
      console.log(`[useTypingStatus] Removed: ${user_id}`);
    };

    const doInitialFetch = async () => {
      if (!isActive || fetchRef.current) return;
      fetchRef.current = true;
      console.log(`[useTypingStatus] Fetching initial`);
      try {
        const { data: res, error } = await supabase
          .from("typing_status" as any)
          .select("*")
          .eq("room_id", roomId)
          .eq("is_typing", true);

        if (error) throw error;

        const data: TypingRow[] = Array.isArray(res) ? res.map((row: any): TypingRow => ({
          ...row,
          room_id: row.room_id || roomId,
          user_id: row.user_id,
          is_typing: row.is_typing ?? false,
          updated_at: row.updated_at || new Date().toISOString(),
        })) : [];

        console.log(`[useTypingStatus] Initial fetch: ${data.length} typers (is_typing=true)`, data.map(d => ({ id: d.user_id, typing: d.is_typing })));

        if (isActive && userId && !showSelfIndicator) {
          setTypingUsers(data.filter((d) => d.user_id !== userId));
        } else {
          setTypingUsers(data);
        }
      } catch (err) {
        console.error("[useTypingStatus] Initial fetch error:", err);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(doInitialFetch, 1000);
        }
      }
    };

    const channel = supabase
      .channel(`room-typing-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_status" as any,
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
            console.log(`[useTypingStatus] Event ${payload.eventType}: ${row.user_id} (is_typing: ${row.is_typing})`); // NEW: Log is_typing
            
            if (!row || (!showSelfIndicator && userId && row.user_id === userId)) {
              console.log("[useTypingStatus] Skipped self/invalid");
              return;
            }

            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              upsertTypingRow(row);
            } else if (payload.eventType === "DELETE" && payload.old) {
              removeTypingRow(payload.old.user_id);
            }
          } catch (err) {
            console.error("[useTypingStatus] Realtime error:", err);
          }
        }
      )
      .subscribe((status: string) => { // FIXED: String type
        console.log(`[useTypingStatus] Sub status: ${status}`);
        if (status === 'SUBSCRIBED') {
          setSubStatus('subscribed');
          doInitialFetch();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setSubStatus('error');
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`[useTypingStatus] Retrying sub (${retryCount}/${maxRetries})`);
            setTimeout(() => supabase.removeChannel(channel), 1000);
          }
        } else if (status === 'JOINING') { // FIXED: String literal
          setSubStatus('initial');
        }
      });

    return () => {
      isActive = false;
      fetchRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, roomId, userId, showSelfIndicator]);

  const typingDisplayText = typingUsers
    .filter((u) => !showSelfIndicator || u.user_id !== userId)
    .map((u) => u.user_id)
    .join(", ");

  return {
    typingUsers,
    startTyping,
    stopTyping,
    handleTyping,
    typingDisplayText,
    subStatus,
  } as const;
}