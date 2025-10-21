"use client";

import { useEffect, useCallback, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/lib/types/supabase";
import { useRoomContext } from "@/lib/store/RoomContext";

export function useTypingStatus() {
  const supabase = createClientComponentClient<Database>();
  const { state, updateTypingUsers, updateTypingText } = useRoomContext();
  const { selectedRoom, user } = state;

  const currentUserId = user?.id ?? null;
  const roomId = selectedRoom?.id ?? null;

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingUsersRef = useRef(state.typingUsers);

  // Keep ref updated
  useEffect(() => {
    typingUsersRef.current = state.typingUsers;
  }, [state.typingUsers]);

  const canOperate = Boolean(roomId && currentUserId);

  // Fetch user profiles efficiently
  const fetchUserProfiles = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return [];

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", userIds);

    if (error) {
      console.error("Error fetching profiles:", error);
      return [];
    }

    return profiles || [];
  }, [supabase]);

  const handleTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;

    channelRef.current.send({
      type: "broadcast",
      event: "typing_start",
      payload: { user_id: currentUserId!, is_typing: true },
    });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "typing_stop",
          payload: { user_id: currentUserId, is_typing: false },
        });
      }
    }, 2000);
  }, [canOperate, currentUserId]);

  const stopTyping = useCallback(() => {
    if (!canOperate || !channelRef.current) return;

    channelRef.current.send({
      type: "broadcast",
      event: "typing_stop",
      payload: { user_id: currentUserId, is_typing: false },
    });

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [canOperate, currentUserId]);

  useEffect(() => {
    if (!canOperate) {
      updateTypingUsers([]);
      return;
    }

    const channel = supabase.channel(`room-typing-${roomId}`);

    channel
      .on("broadcast", { event: "typing_start" }, async ({ payload }) => {
        if (payload.user_id === currentUserId) return;

        const updatedUsers = [...typingUsersRef.current];
        const existingIndex = updatedUsers.findIndex(u => u.user_id === payload.user_id);

        if (existingIndex >= 0) {
          updatedUsers[existingIndex] = { ...updatedUsers[existingIndex], is_typing: true };
        } else {
          // Fetch profile for new typing user
          const profiles = await fetchUserProfiles([payload.user_id]);
          const profile = profiles[0];
          
          updatedUsers.push({
            user_id: payload.user_id,
            is_typing: true,
            display_name: profile?.display_name || undefined,
            username: profile?.username || undefined,
          });
        }

        updateTypingUsers(updatedUsers);
      })
      .on("broadcast", { event: "typing_stop" }, ({ payload }) => {
        updateTypingUsers(
          typingUsersRef.current.filter(u => u.user_id !== payload.user_id)
        );
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      stopTyping();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      updateTypingUsers([]);
    };
  }, [supabase, roomId, currentUserId, canOperate, updateTypingUsers, stopTyping, fetchUserProfiles]);

  // Generate display text with proper names
  useEffect(() => {
    const activeTypers = state.typingUsers.filter(u => u.is_typing);

    if (activeTypers.length === 0) {
      updateTypingText("");
      return;
    }

    const names = activeTypers.map(u => 
      u.display_name || u.username || `User ${u.user_id?.slice(-4) || 'Unknown'}`
    );

    let text = "";
    if (activeTypers.length === 1) {
      text = `${names[0]} is typing...`;
    } else if (activeTypers.length === 2) {
      text = `${names[0]} and ${names[1]} are typing...`;
    } else {
      text = `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]} are typing...`;
    }

    updateTypingText(text);
  }, [state.typingUsers, updateTypingText]);

  return {
    typingUsers: state.typingUsers,
    typingDisplayText: state.typingDisplayText,
    handleTyping,
    stopTyping,
    canOperate,
  };
}