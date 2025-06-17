import { useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomWithMembership = Room & {
     isMember: boolean;
     participationStatus: string | null;
};

export const useFetchRooms = (
     user: { id: string } | undefined,
     checkRoomMembership: (roomId: string) => Promise<boolean>,
     checkRoomParticipation: (roomId: string) => Promise<string | null>,
     setAvailableRooms: (rooms: RoomWithMembership[]) => void, // Change to Zustand-style setter
     setRooms: (rooms: RoomWithMembership[]) => void,
     isMounted: React.MutableRefObject<boolean>,
     initializeDefaultRoom?: () => void
) => {
     const supabase = supabaseBrowser();

     const fetchAvailableRooms = useCallback(async () => {
          if (!user) {
               setAvailableRooms([]);
               setRooms([]);
               return;
          }

          try {
               const { data: memberships, error: memberError } = await supabase
                    .from("room_members")
                    .select("room_id")
                    .eq("user_id", user.id)
                    .eq("status", "accepted");

               if (memberError) {
                    console.error("Error fetching room memberships:", memberError);
                    toast.error("Failed to fetch room memberships");
                    if (isMounted.current) {
                         setAvailableRooms([]);
                         setRooms([]);
                    }
                    return;
               }

               let rooms: Room[] = [];

               if (memberships && memberships.length > 0) {
                    const roomIds = memberships.map((m) => m.room_id);
                    const { data: roomsData, error: roomsError } = await supabase
                         .from("rooms")
                         .select("*")
                         .in("id", roomIds);

                    if (roomsError) {
                         console.error("Error fetching rooms:", roomsError);
                         toast.error("Failed to fetch rooms");
                         if (isMounted.current) {
                              setAvailableRooms([]);
                              setRooms([]);
                         }
                         return;
                    }

                    rooms = roomsData || [];
               }

               if (rooms.length === 0) {
                    const { data: generalChat, error: generalChatError } = await supabase
                         .from("rooms")
                         .select("*")
                         .eq("name", "General Chat")
                         .eq("is_private", false)
                         .single();

                    if (generalChatError && generalChatError.code !== "PGRST116") {
                         console.error("Error fetching General Chat:", generalChatError);
                         toast.error("Failed to fetch default room");
                         if (isMounted.current) {
                              setAvailableRooms([]);
                              setRooms([]);
                         }
                         return;
                    }

                    if (!generalChat) {
                         const { data: newRoom, error: createError } = await supabase
                              .from("rooms")
                              .upsert(
                                   {
                                        name: "General Chat",
                                        is_private: false,
                                        created_by: user.id,
                                        created_at: new Date().toISOString(),
                                   },
                                   { onConflict: "name,is_private" }
                              )
                              .select()
                              .single();

                         if (createError || !newRoom) {
                              console.error("Error creating General Chat:", createError);
                              toast.error("Failed to create default room");
                              if (isMounted.current) {
                                   setAvailableRooms([]);
                                   setRooms([]);
                              }
                              return;
                         }

                         const { error: joinError } = await supabase
                              .from("room_members")
                              .insert({
                                   room_id: newRoom.id,
                                   user_id: user.id,
                                   status: "accepted",
                                   joined_at: new Date().toISOString(),
                                   active: true,
                              });

                         if (joinError) {
                              console.error("Error joining General Chat:", joinError);
                              toast.error("Failed to join default room");
                              if (isMounted.current) {
                                   setAvailableRooms([]);
                                   setRooms([]);
                              }
                              return;
                         }

                         rooms = [newRoom];
                    } else {
                         const isMember = await checkRoomMembership(generalChat.id);
                         if (!isMember) {
                              const { error: joinError } = await supabase
                                   .from("room_members")
                                   .insert({
                                        room_id: generalChat.id,
                                        user_id: user.id,
                                        status: "accepted",
                                        joined_at: new Date().toISOString(),
                                        active: true,
                                   });

                              if (joinError) {
                                   console.error("Error joining General Chat:", joinError);
                                   toast.error("Failed to join default room");
                                   if (isMounted.current) {
                                        setAvailableRooms([]);
                                        setRooms([]);
                                   }
                                   return;
                              }
                         }
                         rooms = [generalChat];
                    }
               }

               const roomsWithMembership = await Promise.all(
                    rooms.map(async (room) => ({
                         ...room,
                         isMember: await checkRoomMembership(room.id),
                         participationStatus: await checkRoomParticipation(room.id),
                    }))
               );

               if (isMounted.current) {
                    setAvailableRooms(roomsWithMembership);
                    setRooms(roomsWithMembership);
                    if (initializeDefaultRoom) {
                         initializeDefaultRoom();
                    }
               }
          } catch (error) {
               console.error("Error fetching rooms:", error);
               toast.error("Failed to fetch rooms");
               if (isMounted.current) {
                    setAvailableRooms([]);
                    setRooms([]);
               }
          }
     }, [user, supabase, checkRoomMembership, checkRoomParticipation, setAvailableRooms, setRooms, isMounted, initializeDefaultRoom]);

     return { fetchAvailableRooms };
};