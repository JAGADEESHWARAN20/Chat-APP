// hooks/useTypingStatus.ts
"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/database.types";
import { useRoomContext } from "@/lib/store/RoomContext";
import debounce from "lodash.debounce";

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

  // ---- Safely extract name ----
  const currentUserName =
    state.user?.user_metadata?.display_name ||
    state.user?.user_metadata?.username ||
    state.user?.email?.split("@")[0] ||
    "Unknown";

  // ---- Broadcasts ----
  const startTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    const payload = {
      user_id: currentUserId!,
      is_typing: true,
      display_name: currentUserName,
      username: currentUserName,
    };
    channelRef.current.send({ type: "broadcast", event: "typing_start", payload });
    console.log("[useTypingStatus] ✅ startTyping broadcast:", payload);
  }, [canOperate, currentUserId, currentUserName]);

  const stopTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    const payload = { user_id: currentUserId!, is_typing: false };
    channelRef.current.send({ type: "broadcast", event: "typing_stop", payload });
    console.log("[useTypingStatus] ✅ stopTyping broadcast:", payload);
  }, [canOperate, currentUserId]);

  // ---- Debounced typing handler ----
  const debouncedStartTyping = useMemo(
    () => debounce(startTyping, 500, { leading: true, trailing: false }),
    [startTyping]
  );

  const handleTyping = useCallback(() => {
    if (!canOperate) return;
    debouncedStartTyping();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => stopTyping(), 2000);
  }, [canOperate, debouncedStartTyping, stopTyping]);

  // ---- Subscriptions ----
  useEffect(() => {
    if (!roomId || !canOperate) {
      setTypingUsers([]);
      return;
    }

    const channel = supabase.channel(`room-typing-${roomId}`);

    channel
      .on("broadcast", { event: "typing_start" }, ({ payload }: { payload: TypingUser }) => {
        if (payload.user_id === currentUserId && !showSelfIndicator) return;
        setTypingUsers((prev) => {
          const filtered = prev.filter((u) => u.user_id !== payload.user_id);
          const updated = [...filtered, { ...payload, is_typing: true }];
          return updated;
        });
      })
      .on("broadcast", { event: "typing_stop" }, ({ payload }: { payload: TypingUser }) => {
        setTypingUsers((prev) => prev.filter((u) => u.user_id !== payload.user_id));
      })
      .subscribe((status) => {
        console.log(`[useTypingStatus] Subscribed: ${status}`);
      });

    channelRef.current = channel;

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      stopTyping();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [supabase, roomId, currentUserId, showSelfIndicator, canOperate, stopTyping]);

  // ---- Display text ----
  const typingDisplayText = useMemo(() => {
    const active = typingUsers.filter((u) => u.is_typing);
    if (active.length === 0) return "";
    const names = active.map(
      (u) => u.display_name || u.username || `User ${u.user_id.slice(-4)}`
    );
    const text =
      active.length === 1
        ? `${names[0]} is typing...`
        : `${names.join(", ")} are typing...`;
    return text;
  }, [typingUsers]);

  return { typingUsers, startTyping, stopTyping, handleTyping, typingDisplayText } as const;
}
