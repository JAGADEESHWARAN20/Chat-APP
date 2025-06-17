"use client";

import { useEffect } from "react";
import { useRoomStore } from "@/lib/store/roomstore";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useUser } from "@/lib/store/user";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";

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

     useEffect(() => {
          if (!user) {
               setRooms([]); // Reset state if no user
               return;
          }

          const initializeRooms = async () => {
               try {
                    // First, check if default room exists
                    const { data: existingRoom, error: checkError } = await supabase
                         .from("rooms")
                         .select("*")
                         .eq("name", "General Chat")
                         .eq("is_private", false)
                         .maybeSingle();

                    if (checkError) {
                         console.error("Error checking for General Chat:", checkError);
                         throw new Error("Failed to check for General Chat");
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
                                   { onConflict: "name,is_private" } // Requires a unique constraint on (name, is_private)
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

                    // Load all rooms for the user
                    const { data: roomsData, error: loadError } = await supabase
                         .from("rooms")
                         .select(
                              `
            id,
            name,
            is_private,
            created_by,
            created_at,
            room_members!inner (
                status,
                user_id
            )
          `
                         )
                         .eq("room_members.user_id", user.id)
                         .eq("room_members.status", "accepted");

                    if (loadError) {
                         console.error("Error loading rooms:", loadError);
                         throw new Error("Failed to load rooms");
                    }

                    if (roomsData) {
                         // Filter out rooms with null created_by and transform the data
                         const filteredRooms = roomsData.filter((room) => room.created_by !== null) as Room[];
                         const transformedRooms = await transformRooms(filteredRooms, user.id, supabase);
                         setRooms(transformedRooms);
                         initializeDefaultRoom();
                    } else {
                         setRooms([]);
                    }
               } catch (error: any) {
                    console.error("Error initializing rooms:", error);
                    toast.error(error.message || "Failed to initialize rooms");
                    setRooms([]);
               }
          };

          initializeRooms();

          // Subscribe to room_members changes (since we filter by user_id in room_members)
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
                         initializeRooms();
                    }
               )
               .subscribe((status) => {
                    console.log("Room subscription status:", status);
               });

          return () => {
               supabase.removeChannel(roomChannel);
          };
     }, [user, setRooms, initializeDefaultRoom, supabase]);

     return null;
}