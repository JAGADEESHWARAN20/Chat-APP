// hooks/useTypingStatus.ts - FIXED: Added logs for setTypingUsers, ensured payload has is_typing, filter logs, state propagation debug
"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/database.types";
import { useRoomContext } from "@/lib/store/RoomContext";

type TypingUser = {
  user_id: string;
  is_typing: boolean;
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

  const startTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    const payload = {
      user_id: currentUserId,
      is_typing: true,
      display_name: state.user?.user_metadata?.display_name,
      username: state.user?.user_metadata?.username,
    };
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing_start',
      payload,
    });
    console.log("[useTypingStatus] ✅ startTyping broadcast:", payload);
  }, [canOperate, currentUserId, state.user]);

  const stopTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    const payload = { user_id: currentUserId, is_typing: false };
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing_stop',
      payload,
    });
    console.log("[useTypingStatus] ✅ stopTyping broadcast:", payload);
  }, [canOperate, currentUserId]);

  const handleTyping = useCallback(() => {
    if (!canOperate) return;
    startTyping();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => stopTyping(), 1500);
  }, [startTyping, stopTyping, canOperate]);

  useEffect(() => {
    if (!roomId || !canOperate) {
      setTypingUsers([]);
      return;
    }

    const channel = supabase.channel(`room-typing-${roomId}`);

    channel
      .on('broadcast', { event: 'typing_start' }, ({ payload }: { payload: TypingUser }) => {
        console.log("[useTypingStatus] Received typing_start payload:", payload);
        if (payload.user_id === currentUserId) return;
        setTypingUsers((prev) => {
          const filtered = prev.filter((u) => u.user_id !== payload.user_id);
          const newUser = { ...payload, is_typing: true };
          const updated = [...filtered, newUser];
          console.log("[useTypingStatus] Updated typingUsers after start:", updated.map(u => u.user_id));
          return updated;
        });
      })
      .on('broadcast', { event: 'typing_stop' }, ({ payload }: { payload: TypingUser }) => {
        console.log("[useTypingStatus] Received typing_stop payload:", payload);
        setTypingUsers((prev) => {
          const updated = prev.filter((u) => u.user_id !== payload.user_id);
          console.log("[useTypingStatus] Updated typingUsers after stop:", updated.map(u => u.user_id));
          return updated;
        });
      })
      .subscribe((status: string) => {
        console.log(`[useTypingStatus] Sub: ${status}`);
        if (status === 'SUBSCRIBED') {
          stopTyping();
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

  const typingDisplayText = useMemo(() => {
    const active = typingUsers.filter(u => u.is_typing);
    const names = active.map(u => u.display_name || u.username || `User ${u.user_id.slice(-4)}`);
    const text = names.join(', ');
    console.log("[useTypingStatus] typingDisplayText:", text, "active users:", active.length);
    return text;
  }, [typingUsers]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
    handleTyping,
    typingDisplayText,
  } as const;
}