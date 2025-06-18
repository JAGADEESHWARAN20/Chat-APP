"use client";

import { useEffect, useCallback, useRef } from "react"; // Added useRef
import { debounce } from "lodash";
import { useRoomStore } from "@/lib/store/roomstore";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useUser } from "@/lib/store/user";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";
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

          if (error) throw new Error("Failed to fetch room participations");

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
     const isMounted = useRef(true);
     const initializationInProgress = useRef(false);

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
          isMounted,
          initializeDefaultRoom
     );

     const initializeRooms = useCallback(async () => {
          if (initializationInProgress.current || !user) {
               console.log("Initialization already in progress or no user");
               return;
          }

          initializationInProgress.current = true;

          try {
               console.log("[RoomInitializer] Starting room initialization");
               const timestamp = new Date().toISOString();

               // Check or create General Chat
               const { data: existingRoom, error: checkError } = await supabase
                    .from("rooms")
                    .select("*")
                    .eq("name", "General Chat")
                    .eq("is_private", false)
                    .single();

               if (checkError && checkError.code !== "PGRST116") {
                    console.error("[RoomInitializer] Error checking for General Chat:", checkError);
                    throw checkError;
               }

               let roomId: string;
               if (!existingRoom) {
                    console.log("[RoomInitializer] Creating General Chat room");
                    const { data: newRoom, error: createError } = await supabase.rpc("create_room_with_member", {
                         p_name: "General Chat",
                         p_is_private: false,
                         p_user_id: user.id,
                         p_timestamp: timestamp
                    });
                    if (createError) {
                         if (createError.code === "23505") {
                              console.log("[RoomInitializer] Room already exists, fetching rooms...");
                              await fetchAvailableRooms();
                              return;
                         }
                         console.error("[RoomInitializer] Error creating General Chat:", createError);
                         throw createError;
                    }
                    roomId = newRoom[0].id;
               } else {
                    roomId = existingRoom.id;
                    const isMember = await checkRoomMembership(roomId);
                    if (!isMember) {
                         const { error: joinError } = await supabase
                              .from("room_members")
                              .insert({
                                   room_id: roomId,
                                   user_id: user.id,
                                   status: "accepted",
                                   joined_at: timestamp,
                                   active: true,
                              });
                         if (joinError && joinError.code !== "23505") {
                              console.error("[RoomInitializer] Error joining General Chat:", joinError);
                              throw joinError;
                         }
                    }
               }

               console.log("[RoomInitializer] Fetching all available rooms");
               await fetchAvailableRooms();
               if (initializeDefaultRoom) initializeDefaultRoom();
          } catch (error) {
               console.error("[RoomInitializer] Initialization error:", error);
               toast.error("Room initialization failed");
               setRooms([]);
          } finally {
               initializationInProgress.current = false;
          }
     }, [user, supabase, fetchAvailableRooms, setRooms, initializeDefaultRoom, checkRoomMembership]);

     useEffect(() => {
          let isActive = true;

          if (!user) {
               setRooms([]);
               return;
          }

          const debouncedInit = debounce(() => {
               if (isActive && user) initializeRooms();
          }, 300);

          debouncedInit();

          const roomChannel = supabase.channel("room_members_changes")
               .on(
                    "postgres_changes",
                    {
                         event: "*",
                         schema: "public",
                         table: "room_members",
                         filter: `user_id=eq.${user.id}`,
                    },
                    (payload) => {
                         console.log("Room membership change detected:", payload);
                         if (isActive) fetchAvailableRooms();
                    }
               )
               .subscribe((status) => {
                    console.log("Room subscription status:", status);
               });

          return () => {
               isActive = false;
               roomChannel.unsubscribe();
               isMounted.current = false;
               debouncedInit.cancel();
          };
     }, [user, setRooms, supabase, fetchAvailableRooms, initializeRooms]);

     return null;
}