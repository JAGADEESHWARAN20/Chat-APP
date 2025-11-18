"use client";

import { useRef, useEffect } from "react";
import { useRoomStore, RoomWithMembership } from "../store/roomstore"; // ← Import type from store
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/store/user";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";

type Room = Database["public"]["Tables"]["rooms"]["Row"];

// Enhanced transform with memberCount (matches store type exactly)
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

    // For each room, fetch member count (optimized: batch if possible, but single queries for simplicity)
    const enrichedRooms = await Promise.all(
      rooms.map(async (room) => {
        // Member count from room_members (accepted only)
        const { count: memberCount } = await supabase
          .from("room_members")
          .select("*", { count: "exact", head: true })
          .eq("room_id", room.id)
          .eq("status", "accepted");

        // Participant status
        const participation = participations?.find((p) => p.room_id === room.id);
        const isMember = participation?.status === "accepted" || false;

        return {
          ...room,
          isMember,
          participationStatus: participation?.status || null,
          memberCount: memberCount ?? 0, // ← Critical: Include required field
          participant_count: undefined,
          online_users: undefined,
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
      participationStatus: null,
      memberCount: 0,
      participant_count: undefined,
      online_users: undefined,
    }));
  }
};

function InitRoom({ rooms }: { rooms: Room[] }) {
  const initState = useRef(false);
  const user = useUser((state) => state.user);
  const supabase = getSupabaseBrowserClient();
  const setRooms = useRoomStore((state) => state.setRooms); // ← Use store setter

  useEffect(() => {
    if (!initState.current && user && rooms.length > 0) {
      const initialize = async () => {
        try {
          const transformedRooms = await transformRooms(rooms, user.id, supabase);
          setRooms(transformedRooms); // ← Now fully typed with memberCount
          initState.current = true;
        } catch (error) {
          console.error("Error initializing rooms:", error);
          toast.error(error instanceof Error ? error.message : "Failed to initialize rooms");
        }
      };

      initialize();
    }
  }, [rooms, user, supabase, setRooms]); // Added setRooms to deps

  return null;
}

export default InitRoom;