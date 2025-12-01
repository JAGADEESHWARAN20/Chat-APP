"use client";

import { useRef, useEffect } from "react";
import { RoomData, useUnifiedStore } from "@/lib/store/unified-roomstore";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/store/user";
import { toast } from "@/components/ui/sonner";
import type { Database } from "@/lib/types/supabase";

type Room = Database["public"]["Tables"]["rooms"]["Row"];

/**
 * Transform normal DB rooms into RoomData[] used by unified-roomstore
 */
const transformRooms = async (
  rooms: Room[],
  userId: string,
  supabase: ReturnType<typeof getSupabaseBrowserClient>
) => {
  try {
    const { data: participations, error: partError } = await supabase
      .from("room_participants")
      .select("*")
      .eq("user_id", userId);

    if (partError) throw new Error("Failed to fetch room participations");

    return await Promise.all(
      rooms.map(async (room) => {
        const { count: memberCount } = await supabase
          .from("room_members")
          .select("*", { head: true, count: "exact" })
          .eq("room_id", room.id)
          .eq("status", "accepted");

        const participation = participations?.find(
          (p) => p.room_id === room.id
        );

        const rawStatus = participation?.status;
        const participation_status =
          rawStatus === "pending" || rawStatus === "accepted" || rawStatus === "rejected"
            ? rawStatus
            : null;

        const is_member = participation_status === "accepted";

        return {
          id: room.id,
          name: room.name,
          is_private: room.is_private,
          created_by: room.created_by,
          created_at: room.created_at,

          is_member,
          participation_status,
          member_count: memberCount ?? 0,
          online_users: 0,
          unread_count: 0,
          latest_message: null,
          latest_message_created_at: null,
        };
      })
    );
  } catch (error) {
    console.error("Transform error:", error);

    return rooms.map((room) => ({
      id: room.id,
      name: room.name,
      is_private: room.is_private,
      created_by: room.created_by,
      created_at: room.created_at,

      is_member: false,
      participation_status: null,
      member_count: 0,
      online_users: 0,
      unread_count: 0,
      latest_message: null,
      latest_message_created_at: null,
    }));
  }
};

export default function InitRoom({ rooms }: { rooms: Room[] }) {
  const supabase = getSupabaseBrowserClient();
  const user = useUser((state) => state.user);
  const setRooms = useUnifiedStore((state) => state.setRooms);

  const initState = useRef(false);

  useEffect(() => {
    if (!initState.current && user && rooms.length > 0) {
      const run = async () => {
        try {
          const result = await transformRooms(rooms, user.id, supabase);

          setRooms(result as RoomData[]);
          initState.current = true;

          console.log(`✅ Initialized ${result.length} rooms`);
        } catch (error) {
          toast.error("Failed to initialize rooms");
          console.error(error);
        }
      };

      run();
    }
  }, [rooms, user, supabase, setRooms]);

  return null;
}
