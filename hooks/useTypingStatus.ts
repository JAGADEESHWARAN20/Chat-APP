// hooks/useTypingStatus.ts - FULL FIXED: Broadcast for instant realtime (no DB lag), typed events/payloads, fast start/stop (1.5s expire), RoomContext integration, TS-safe
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/database.types";
import { useRoomContext } from "@/lib/store/RoomContext";

type TypingUser = {
  user_id: string;
  is_typing: boolean; // FIXED: Add is_typing for filter
  display_name?: string;
  username?: string;
};

interface UseTypingStatusProps {
  roomId: string;
  showSelfIndicator?: boolean;
}

export function useTypingStatus({ roomId, showSelfIndicator = false }: UseTypingStatusProps) {
  const supabase = createClientComponentClient<Database>();
  const { state } = useRoomContext();
  const currentUserId = state.user?.id ?? null;
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const canOperate = Boolean(roomId && currentUserId);

  // Broadcast start (instant)
  const startTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing_start',
      payload: {
        user_id: currentUserId,
        is_typing: true,
        display_name: state.user?.user_metadata?.display_name,
        username: state.user?.user_metadata?.username,
      },
    });
    console.log("[useTypingStatus] ✅ startTyping broadcast");
  }, [canOperate, currentUserId, state.user]);

  // Broadcast stop (instant)
  const stopTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing_stop',
      payload: { user_id: currentUserId, is_typing: false },
    });
    console.log("[useTypingStatus] ✅ stopTyping broadcast");
  }, [canOperate, currentUserId]);

  // Handle typing (on keydown for instant, 1.5s expire for quick stop)
  const handleTyping = useCallback(() => {
    if (!canOperate) return;
    startTyping();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => stopTyping(), 1500); // FAST: 1.5s
  }, [startTyping, stopTyping, canOperate]);

  // Broadcast listener (instant events)
  useEffect(() => {
    if (!roomId || !canOperate) {
      setTypingUsers([]);
      return;
    }

    const channel = supabase.channel(`room-typing-${roomId}`);

    // FIXED: Typed broadcast with schema filter
    channel
      .on('broadcast', { event: 'typing_start' }, ({ payload }: { payload: TypingUser }) => {
        if (payload.user_id === currentUserId) return; // Skip self
        setTypingUsers((prev) => {
          const filtered = prev.filter((u) => u.user_id !== payload.user_id);
          return [...filtered, { ...payload, is_typing: true }];
        });
        console.log("[useTypingStatus] Typing start:", payload.user_id);
      })
      .on('broadcast', { event: 'typing_stop' }, ({ payload }: { payload: TypingUser }) => {
        setTypingUsers((prev) => prev.filter((u) => u.user_id !== payload.user_id));
        console.log("[useTypingStatus] Typing stop:", payload.user_id);
      })
      .subscribe((status: string) => {
        console.log(`[useTypingStatus] Sub: ${status}`);
        if (status === 'SUBSCRIBED') {
          stopTyping(); // Initial cleanup
        }
      });

    channelRef.current = channel;

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      stopTyping();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [supabase, roomId, currentUserId, stopTyping, showSelfIndicator]);

  // Display text
  const typingDisplayText = typingUsers
    .filter(u => u.is_typing)
    .map(u => u.display_name || u.username || `User ${u.user_id.slice(-4)}`)
    .join(', ');

  return {
    typingUsers,
    startTyping,
    stopTyping,
    handleTyping,
    typingDisplayText,
  } as const;
}