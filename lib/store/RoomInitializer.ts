"use client";

import { useEffect, useCallback } from "react";
import { useRoomStore } from "@/lib/store/roomstore";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useUser } from "@/lib/store/user";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";
import { debounce } from "lodash";
import { useFetchRooms } from "@/hooks/useFetchRooms";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomWithMembership = Room & {
  isMember: boolean;
  participationStatus: string | null;
};

const transformRooms = async (
  rooms: Room[],
  userId: string,
  supabase: ReturnType<typeof supabaseBrowser>
): Promise<RoomWithMembership[]> => {
  try {
    const { data: participations, error } = await supabase
      .from("room_participants")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      throw new Error("Failed to fetch room participations");
    }

    return rooms.map((room) => ({
      ...room,
      isMember: participations?.some((p) => p.room_id === room.id && p.status === "accepted") || false,
      participationStatus: participations?.find((p) => p.room_id === room.id)?.status || null,
    }));
  } catch (error) {
    throw error;
  }
};

export default function RoomInitializer() {
  const { setRooms, initializeDefaultRoom } = useRoomStore();
  const user = useUser((state) => state.user);
  const supabase = supabaseBrowser();

  const checkRoomMembership = useCallback(
    async (roomId: string) => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .single();
      if (error && error.code !== "PGRST116") {
        console.error("Error checking room membership:", error);
        return false;
      }
      return data?.status === "accepted";
    },
    [user, supabase]
  );

  const checkRoomParticipation = useCallback(
    async (roomId: string) => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("room_participants")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .single();
      if (error && error.code !== "PGRST116") {
        console.error("Error checking room participation:", error);
        return null;
      }
      return data?.status || null;
    },
    [user, supabase]
  );

  const { fetchAvailableRooms } = useFetchRooms(
    user,
    checkRoomMembership,
    checkRoomParticipation,
    setRooms,
    setRooms,
    { current: true },
    initializeDefaultRoom
  );

  const initializeRooms = useCallback(async () => {
    try {
      if (!user) {
        setRooms([]);
        return;
      }

      // First, check if default room exists
      let existingRoom: Room | null = null;
      try {
        const { data, error: checkError } = await supabase
          .from("rooms")
          .select("*")
          .eq("name", "General Chat")
          .eq("is_private", false)
          .maybeSingle();

        if (checkError) {
          console.error("Error checking for General Chat:", checkError);
          // If the error is due to RLS recursion, log it and proceed without creating a new room
          if (checkError.code === "42P17") {
            console.warn("RLS policy issue detected. Skipping default room creation.");
            await fetchAvailableRooms();
            return;
          }
          throw new Error("Failed to check for General Chat");
        }
        existingRoom = data;
      } catch (error: any) {
        console.error("Caught error while checking for General Chat:", error);
        throw error;
      }

      const timestamp = new Date().toISOString();

      if (!existingRoom) {
        // Create default room with timestamp
        const { data: newRoom, error: createError } = await supabase
          .from("rooms")
          .upsert(
            {
              name: "General Chat",
              is_private: false,
              created_by: user.id,
              created_at: timestamp,
            },
            { onConflict: "name,is_private" }
          )
          .select()
          .single();

        if (createError) {
          console.error("Error creating General Chat:", createError);
          throw new Error("Failed to create General Chat");
        }

        if (newRoom) {
          // Add creator as room member
          const { error: memberError } = await supabase
            .from("room_members")
            .insert({
              room_id: newRoom.id,
              user_id: user.id,
              status: "accepted",
              joined_at: timestamp,
              active: true,
            });

          if (memberError) {
            console.error("Error adding room member:", memberError);
            throw new Error("Failed to add user to General Chat");
          }
        }
      }

      // Fetch rooms using the hook
      await fetchAvailableRooms();
    } catch (error: any) {
      console.error("Error initializing rooms:", error);
      toast.error(error.message || "Failed to initialize rooms");
      setRooms([]);
    }
  }, [user, supabase, fetchAvailableRooms, setRooms, initializeDefaultRoom]);

  const debouncedInitializeRooms = debounce(initializeRooms, 300);

  useEffect(() => {
    if (!user) {
      setRooms([]);
      return;
    }

    initializeRooms();

    // Subscribe to room_members changes
    const roomChannel = supabase
      .channel("room_members_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_members",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log("Room membership change detected, refreshing rooms...");
          debouncedInitializeRooms();
        }
      )
      .subscribe((status) => {
        console.log("Room subscription status:", status);
      });

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [user, setRooms, supabase, debouncedInitializeRooms, initializeRooms]);

  return null;
}