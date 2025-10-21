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

  const roomId = selectedRoom?.id ?? null;
  const currentUserId = user?.id ?? null;

  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const canOperate = Boolean(roomId && currentUserId);

  const startTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    const payload = {
      user_id: currentUserId!,
      is_typing: true,
      display_name: user?.user_metadata?.display_name,
      username: user?.user_metadata?.username,
    };
    channelRef.current.send({
      type: "broadcast",
      event: "typing_start",
      payload,
    });
  }, [canOperate, currentUserId, user]);

  const stopTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;
    const payload = { user_id: currentUserId!, is_typing: false };
    channelRef.current.send({
      type: "broadcast",
      event: "typing_stop",
      payload,
    });
  }, [canOperate, currentUserId]);

  const handleTyping = useCallback(() => {
    if (!canOperate) return;
    startTyping();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(stopTyping, 1500);
  }, [canOperate, startTyping, stopTyping]);

  useEffect(() => {
    if (!canOperate) {
      setTypingUsers([]);
      return;
    }

    const channel = supabase.channel(`room-typing-${roomId}`);

    channel
      .on("broadcast", { event: "typing_start" }, ({ payload }: { payload: TypingUser }) => {
        if (payload.user_id === currentUserId) return;
        setTypingUsers((prev) => {
          const existing = prev.find((u) => u.user_id === payload.user_id);
          if (existing) return prev;
          return [...prev, { ...payload, is_typing: true }];
        });
      })
      .on("broadcast", { event: "typing_stop" }, ({ payload }: { payload: TypingUser }) => {
        setTypingUsers((prev) => prev.filter((u) => u.user_id !== payload.user_id));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") stopTyping();
      });

    channelRef.current = channel;

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      stopTyping();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [supabase, roomId, canOperate, currentUserId, stopTyping]);

  const typingDisplayText = useMemo(() => {
    const active = typingUsers.filter((u) => u.is_typing);
    if (active.length === 0) return "";
    const names = active.map(
      (u) => u.display_name || u.username || `User ${u.user_id.slice(-4)}`
    );
    return `${names.join(", ")} ${active.length > 1 ? "are" : "is"} typing...`;
  }, [typingUsers]);

  return {
    typingUsers,
    typingDisplayText,
    handleTyping,
    startTyping,
    stopTyping,
  };
}
