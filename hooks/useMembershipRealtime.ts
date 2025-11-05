"use client";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRoomActions } from "@/lib/store/RoomContext";

export function useMembershipRealtime(userId: string | null | undefined) {
  const supabase = getSupabaseBrowserClient();
  const { mergeRoomMembership, setSelectedRoomId } = useRoomActions();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`room-membership:${userId}`);

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "room_participants", filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as { room_id: string; status: string };
        if (row?.status === "accepted") {
          mergeRoomMembership(row.room_id, { isMember: true, participationStatus: "accepted" });
          setSelectedRoomId(row.room_id);
        }
      }
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "room_members", filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as { room_id: string };
        if (row) {
          mergeRoomMembership(row.room_id, { isMember: true, participationStatus: "accepted" });
          setSelectedRoomId(row.room_id);
        }
      }
    );

    // ✅ IMPORTANT: subscribe without awaiting
    channel.subscribe();

    // ✅ Cleanup is now synchronous (no async return)
    return () => {
      supabase.removeChannel(channel);
    };

  }, [userId, mergeRoomMembership, setSelectedRoomId]);
}
