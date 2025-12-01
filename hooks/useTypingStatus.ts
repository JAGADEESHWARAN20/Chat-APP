"use client";

import { useEffect, useCallback, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/supabase";

import { 
  useUnifiedStore, 
  useRoomById 
} from "@/lib/store/unified-roomstore";

export function useTypingStatus() {
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // --- UNIFIED STORE FIELDS ---
  const selectedRoomId = useUnifiedStore((s) => s.selectedRoomId);
  const typingUsers = useUnifiedStore((s) => s.typingUsers);
  const typingDisplayText = useUnifiedStore((s) => s.typingDisplayText);

  const updateTypingUsers = useUnifiedStore((s) => s.updateTypingUsers);
  const updateTypingText = useUnifiedStore((s) => s.updateTypingText);

  const userId = useUnifiedStore((s) => s.userId);

  const selectedRoom = useRoomById(selectedRoomId);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingUsersRef = useRef(typingUsers);

  // Keep ref in sync
  useEffect(() => {
    typingUsersRef.current = typingUsers;
  }, [typingUsers]);

  const canOperate = Boolean(selectedRoomId && userId);

  /* -------------------------------------------------------
     SEND TYPING START/STOP
  ------------------------------------------------------- */

  const handleTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;

    channelRef.current.send({
      type: "broadcast",
      event: "typing_start",
      payload: { user_id: userId, is_typing: true }
    });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      channelRef.current?.send({
        type: "broadcast",
        event: "typing_stop",
        payload: { user_id: userId, is_typing: false }
      });
    }, 2000);
  }, [canOperate, userId]);


  const stopTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;

    channelRef.current.send({
      type: "broadcast",
      event: "typing_stop",
      payload: { user_id: userId, is_typing: false },
    });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, [canOperate, userId]);

  /* -------------------------------------------------------
     UPDATE "XYZ is typing..."
  ------------------------------------------------------- */

  useEffect(() => {
    const others = typingUsers.filter((u) => u.user_id !== userId);

    if (others.length === 0) {
      updateTypingText("");
      return;
    }

    const names = others.map(
      (u) => u.display_name || `User ${u.user_id.slice(-4)}`
    );

    let text = "";
    if (names.length === 1) text = `${names[0]} is typing...`;
    else if (names.length === 2) text = `${names[0]} and ${names[1]} are typing...`;
    else text = `${names.length} people are typing...`;

    updateTypingText(text);
  }, [typingUsers, userId, updateTypingText]);

  /* -------------------------------------------------------
     REALTIME BROADCAST CHANNEL
  ------------------------------------------------------- */

  useEffect(() => {
    if (!canOperate) {
      updateTypingUsers([]);
      return;
    }

    const channel = supabase.channel(`typing-${selectedRoomId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "typing_start" }, ({ payload }) => {
        if (payload.user_id === userId) return;

        const existing = typingUsersRef.current.find(
          (u) => u.user_id === payload.user_id
        );

        let updated;

        if (existing) {
          updated = typingUsersRef.current.map((u) =>
            u.user_id === payload.user_id
              ? { ...u, is_typing: true }
              : u
          );
        } else {
          updated = [
            ...typingUsersRef.current,
            {
              user_id: payload.user_id,
              is_typing: true,
              display_name: `User ${payload.user_id.slice(-4)}`,
            },
          ];
        }

        updateTypingUsers(updated);
      })

      .on("broadcast", { event: "typing_stop" }, ({ payload }) => {
        updateTypingUsers(
          typingUsersRef.current.filter(
            (u) => u.user_id !== payload.user_id
          )
        );
      })

      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`🔥 Typing realtime active → room ${selectedRoomId}`);
        }
      });

    channelRef.current = channel;

    return () => {
      stopTyping();
      if (channelRef.current) supabase.removeChannel(channelRef.current);

      channelRef.current = null;
      updateTypingUsers([]);
    };
  }, [selectedRoomId, userId, canOperate, stopTyping]);


  return {
    typingUsers,
    typingDisplayText,
    handleTyping,
    stopTyping,
    canOperate,
  };
}
