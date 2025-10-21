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

export function useTypingStatus() {
  const supabase = createClientComponentClient<Database>();
  const { state } = useRoomContext();
  const { selectedRoom, user } = state;

  const currentUserId = user?.id ?? null;
  const roomId = selectedRoom?.id ?? null;

  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const canOperate = Boolean(roomId && currentUserId);

  // --- START TYPING ---
  const startTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    const payload: TypingUser = {
      user_id: currentUserId!,
      is_typing: true,
      display_name: user?.user_metadata?.display_name,
      username: user?.user_metadata?.username,
    };
    channelRef.current.send({ type: "broadcast", event: "typing_start", payload });
    console.log("[useTypingStatus] 🔵 startTyping broadcast:", payload);
  }, [canOperate, currentUserId, user]);

  // --- STOP TYPING ---
  const stopTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    const payload = { user_id: currentUserId!, is_typing: false };
    channelRef.current.send({ type: "broadcast", event: "typing_stop", payload });
    console.log("[useTypingStatus] 🟣 stopTyping broadcast:", payload);
  }, [canOperate, currentUserId]);

  // --- HANDLE TYPING WITH DEBOUNCE ---
  const handleTyping = useCallback(() => {
    if (!canOperate) return;
    startTyping();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(stopTyping, 1500);
  }, [startTyping, stopTyping, canOperate]);

  // --- SETUP CHANNEL + BROADCAST LISTENERS ---
  useEffect(() => {
    if (!canOperate) {
      console.log("[useTypingStatus] ❌ Cannot operate, missing user or room");
      setTypingUsers([]);
      return;
    }

    const channel = supabase.channel(`room-typing-${roomId}`);

    channel
      .on("broadcast", { event: "typing_start" }, ({ payload }: { payload: TypingUser }) => {
        console.log("[useTypingStatus] 🟢 Received typing_start:", payload);
        if (payload.user_id === currentUserId) return; // Ignore self

        setTypingUsers((prev) => {
          const exists = prev.some((u) => u.user_id === payload.user_id);
          if (exists) return prev; // Prevent duplicates
          const updated = [...prev, { ...payload, is_typing: true }];
          console.log("[useTypingStatus] Updated typingUsers:", updated.map((u) => u.user_id));
          return updated;
        });
      })
      .on("broadcast", { event: "typing_stop" }, ({ payload }: { payload: TypingUser }) => {
        console.log("[useTypingStatus] 🛑 Received typing_stop:", payload);
        setTypingUsers((prev) => {
          const updated = prev.filter((u) => u.user_id !== payload.user_id);
          console.log("[useTypingStatus] Updated typingUsers:", updated.map((u) => u.user_id));
          return updated;
        });
      })
      .subscribe((status) => {
        console.log(`[useTypingStatus] Channel status: ${status}`);
        if (status === "SUBSCRIBED") stopTyping();
      });

    channelRef.current = channel;

    return () => {
      console.log("[useTypingStatus] 🧹 Cleanup");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      stopTyping();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [supabase, roomId, currentUserId, canOperate, stopTyping]);

  // --- COMPUTE TYPING TEXT ---
  const typingDisplayText = useMemo(() => {
    const active = typingUsers.filter((u) => u.is_typing);
    if (active.length === 0) return "";
    const names = active.map(
      (u) => u.display_name || u.username || `User ${u.user_id.slice(-4)}`
    );
    const text =
      active.length > 1 ? `${names.join(", ")} are typing...` : `${names[0]} is typing...`;
    console.log("[useTypingStatus] 💬 typingDisplayText:", text);
    return text;
  }, [typingUsers]);

  return {
    typingUsers,
    typingDisplayText,
    startTyping,
    stopTyping,
    handleTyping,
  } as const;
}
