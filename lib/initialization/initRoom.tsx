"use client";

import { useRef, useEffect } from "react";
import { useUnifiedRoomStore, RoomWithMembership } from "../store/roomstore";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/store/user";
import { toast } from "/components/ui/sonner"
import { Database } from "@/lib/types/supabase";

type Room = Database["public"]["Tables"]["rooms"]["Row"];

// Enhanced transform with proper type safety
const transformRooms = async (
  rooms: Room[],
  userId: string,
  supabase: ReturnType<typeof getSupabaseBrowserClient>
): Promise<RoomWithMembership[]> => {
  try {
    // Fetch participations
    const { data: participations, error: partError } = await supabase
      .from("room_participants")
      .select("*")
      .eq("user_id", userId);

    if (partError) {
      throw new Error("Failed to fetch room participations");
    }

    // For each room, fetch member count
    const enrichedRooms = await Promise.all(
      rooms.map(async (room) => {
        // Member count from room_members (accepted only)
        const { count: memberCount } = await supabase
          .from("room_members")
          .select("*", { count: "exact", head: true })
          .eq("room_id", room.id)
          .eq("status", "accepted");

        // ✅ FIXED: Properly type the participation status
        const participation = participations?.find((p) => p.room_id === room.id);
        const rawStatus = participation?.status;
        
        // Convert string status to the specific union type
        const participationStatus: "pending" | "accepted" | null = 
          rawStatus === "pending" || rawStatus === "accepted" 
            ? rawStatus 
            : null;

        const isMember = participationStatus === "accepted";

        return {
          ...room,
          isMember,
          participationStatus, // ✅ Now properly typed
          memberCount: memberCount ?? 0,
          online_users: undefined,
          unreadCount: undefined,
          latestMessage: undefined,
        };
      })
    );

    return enrichedRooms;
  } catch (error) {
    console.error("Transform error:", error);
    // Fallback: Return with defaults
    return rooms.map((room) => ({
      ...room,
      isMember: false,
      participationStatus: null, // ✅ Proper null type
      memberCount: 0,
      online_users: undefined,
      unreadCount: undefined,
      latestMessage: undefined,
    }));
  }
};

function InitRoom({ rooms }: { rooms: Room[] }) {
  const initState = useRef(false);
  const user = useUser((state) => state.user);
  const supabase = getSupabaseBrowserClient();
  const setRooms = useUnifiedRoomStore((state) => state.setRooms);

  useEffect(() => {
    if (!initState.current && user && rooms.length > 0) {
      const initialize = async () => {
        try {
          const transformedRooms = await transformRooms(rooms, user.id, supabase);
          setRooms(transformedRooms);
          initState.current = true;
          console.log(`✅ Initialized ${transformedRooms.length} rooms`);
        } catch (error) {
          console.error("Error initializing rooms:", error);
          toast.error(error instanceof Error ? error.message : "Failed to initialize rooms");
        }
      };

      initialize();
    }
  }, [rooms, user, supabase, setRooms]);

  return null;
}

export default InitRoom;