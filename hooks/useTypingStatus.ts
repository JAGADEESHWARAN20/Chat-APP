"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/database.types";
import debounce from "lodash.debounce";

type TypingStatus = Database["public"]["Tables"]["typing_status"]["Row"];

export function useTypingStatus(roomId: string, currentUserId: string) {
  const supabase = createClientComponentClient<Database>();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // Debounced function to update typing status
  const debouncedUpdate = useMemo(
    () =>
      debounce(async (isTyping: boolean) => {
        if (!roomId || !currentUserId) return;

        try {
          const { error } = await supabase
            .rpc("upsert_typing_status", {
              p_room_id: roomId,
              p_user_id: currentUserId,
              p_is_typing: isTyping,
            });

          if (error) {
            console.error("Error updating typing status:", error);
          }
        } catch (error) {
          console.error("Unexpected error updating typing status:", error);
        }
      }, 500),
    [roomId, currentUserId, supabase]
  );

  const setIsTyping = useCallback(
    (isTyping: boolean) => {
      debouncedUpdate(isTyping);
    },
    [debouncedUpdate]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedUpdate.cancel();
      // Clear typing status on unmount
      if (roomId && currentUserId) {
        supabase
          .rpc("upsert_typing_status", {
            p_room_id: roomId,
            p_user_id: currentUserId,
            p_is_typing: false,
          })
          .catch((error) => console.error("Error clearing typing status:", error));
      }
    };
  }, [debouncedUpdate, roomId, currentUserId, supabase]);

  // Real-time subscription to typing_status table
  useEffect(() => {
    if (!roomId || !currentUserId) {
      setTypingUsers([]);
      return;
    }

    // Initial fetch of typing users
    const fetchTypingUsers = async () => {
      try {
        const { data, error } = await supabase
          .rpc("get_typing_users", {
            p_room_id: roomId,
            p_stale_threshold: "3 seconds",
          });

        if (error) {
          console.error("Error fetching typing users:", error);
          return;
        }

        const typingUserIds = data
          .filter((status: { user_id: string; is_typing: boolean }) => {
            return status.is_typing && status.user_id !== currentUserId;
          })
          .map((status: { user_id: string }) => status.user_id);

        setTypingUsers(typingUserIds);
      } catch (error) {
        console.error("Unexpected error fetching typing users:", error);
      }
    };

    fetchTypingUsers();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`typing_status:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_status",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          try {
            const { data, error } = await supabase
              .rpc("get_typing_users", {
                p_room_id: roomId,
                p_stale_threshold: "3 seconds",
              });

            if (error) {
              console.error("Error fetching typing users on update:", error);
              return;
            }

            const typingUserIds = data
              .filter((status: { user_id: string; is_typing: boolean }) => {
                return status.is_typing && status.user_id !== currentUserId;
              })
              .map((status: { user_id: string }) => status.user_id);

            setTypingUsers(typingUserIds);
          } catch (error) {
            console.error("Unexpected error processing typing update:", error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId, supabase]);

  return {
    typingUsers,
    setIsTyping,
  };
}
