"use client";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRoomActions } from "@/lib/store/RoomContext";

export function useMembershipRealtime(userId: string | null | undefined) {
  const supabase = getSupabaseBrowserClient();
  const { mergeRoomMembership } = useRoomActions();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`room-membership:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { room_id: string; status: string };
          if (!row) return;
          if (row.status === "accepted") {
            mergeRoomMembership(row.room_id, { isMember: true, participationStatus: "accepted" });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { room_id: string };
          if (!row) return;
          mergeRoomMembership(row.room_id, { isMember: true, participationStatus: "accepted" });
        }
      )
      .subscribe();

    return () => void supabase.removeChannel(channel);
  }, [userId, mergeRoomMembership]);
}
