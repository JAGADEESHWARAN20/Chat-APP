"use client";

import { useEffect, useCallback } from "react";
import { debounce } from "lodash";
import { useRoomStore } from "@/lib/store/roomstore";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useUser } from "@/lib/store/user";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";
import { useFetchRooms } from "@/hooks/useFetchRooms";
import { useRef } from 'react';

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
               // Start transaction for atomic operations
               const { data: existingRoom, error: checkError } = await supabase
                    .from("rooms")
                    .select("*")
                    .eq("name", "General Chat")
                    .eq("is_private", false)
                    .maybeSingle();

               if (checkError) {
                    if (checkError.code === "42P17") {
                         console.warn("RLS policy issue detected, proceeding with room fetch");
                         await fetchAvailableRooms();
                         return;
                    }
                    throw new Error(`Failed to check for General Chat: ${checkError.message}`);
               }

               const timestamp = new Date().toISOString();

               if (!existingRoom) {
                    // Try to create the room with a unique constraint
                    const { data: newRoom, error: createError } = await supabase
                         .from("rooms")
                         .insert({
                              name: "General Chat",
                              is_private: false,
                              created_by: user.id,
                              created_at: timestamp,
                         })
                         .select()
                         .single();

                    if (createError) {
                         if (createError.code === '23505') { // Unique violation
                              console.log("Room already exists (race condition), fetching rooms...");
                              await fetchAvailableRooms();
                              return;
                         }
                         throw new Error(`Failed to create General Chat: ${createError.message}`);
                    }

                    if (newRoom) {
                         // Ensure creator is a room member
                         const { error: memberError } = await supabase
                              .from("room_members")
                              .insert({
                                   room_id: newRoom.id,
                                   user_id: user.id,
                                   status: "accepted",
                                   joined_at: timestamp,
                                   active: true,
                              })
                              .select()
                              .single();

                         if (memberError) {
                              if (memberError.code !== '23505') { // Ignore if already a member
                                   throw new Error(`Failed to add user to General Chat: ${memberError.message}`);
                              }
                         }

                         // Initialize default room
                         initializeDefaultRoom();
                    }
               }

               // Always fetch available rooms to ensure consistency
               await fetchAvailableRooms();

          } catch (error: any) {
               console.error("Error in room initialization:", error);
               toast.error(`Room initialization failed: ${error.message}`);
               setRooms([]);
          } finally {
               initializationInProgress.current = false;
          }
     }, [user, supabase, fetchAvailableRooms, setRooms, initializeDefaultRoom]);

     useEffect(() => {
          let isActive = true;

          if (!user) {
               setRooms([]);
               return;
          }

          // Initial room setup with debounce
          const debouncedInit = debounce(() => {
               if (isActive && user) {
                    initializeRooms();
               }
          }, 300);

          debouncedInit();

          // Set up real-time subscription for room membership changes
          const roomChannel = supabase.channel('room_members_changes')
               .on('postgres_changes',
                    {
                         event: '*',
                         schema: 'public',
                         table: 'room_members',
                         filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                         console.log('Room membership change detected:', payload);
                         if (isActive) {
                              fetchAvailableRooms();
                         }
                    })
               .subscribe((status) => {
                    console.log('Room subscription status:', status);
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