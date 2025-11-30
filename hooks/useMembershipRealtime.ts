"use client";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUnifiedRoomStore } from "@/lib/store/roomstore";

export function useMembershipRealtime(userId: string | null | undefined) {
  const supabase = getSupabaseBrowserClient();

  const { updateRoomMembership, setSelectedRoomId } = useUnifiedRoomStore();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`room-membership:${userId}`);

    // room_participants changes
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "room_participants",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as { room_id: string; status: string };
        if (row?.status === "accepted") {
          updateRoomMembership(row.room_id, {
            isMember: true,
            participationStatus: "accepted",
          });
          setSelectedRoomId(row.room_id);
        }
      }
    );

    // room_members direct insert
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "room_members",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as { room_id: string };
        if (row) {
          updateRoomMembership(row.room_id, {
            isMember: true,
            participationStatus: "accepted",
          });
          setSelectedRoomId(row.room_id);
        }
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, updateRoomMembership, setSelectedRoomId]);
}
