import { useCallback } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { toast } from 'sonner';
import { Database } from '@/lib/types/supabase';
import { useRoomStore } from '@/lib/store/roomstore';

type Room = Database['public']['Tables']['rooms']['Row'];
type RoomWithMembership = Room & {
     isMember: boolean;
     participationStatus: string | null;
};

type RoomMemberRow = {
     rooms: Room | null;
};

export const useFetchRooms = (
     user: { id: string } | undefined,
     checkRoomMembership: (roomId: string) => Promise<boolean>,
     checkRoomParticipation: (roomId: string) => Promise<string | null>,
     setAvailableRooms: React.Dispatch<React.SetStateAction<RoomWithMembership[]>>,
     setRooms: (rooms: RoomWithMembership[]) => void, // Updated type
     isMounted: React.MutableRefObject<boolean>
) => {
     const supabase = supabaseBrowser();

     const fetchAvailableRooms = useCallback(async () => {
          if (!user) {
               setAvailableRooms([]); // Ensure state is reset if no user
               setRooms([]);
               return;
          }

          try {
               // Fetch rooms where the user is a member
               const { data: roomsData, error } = await supabase
                    .from("room_members")
                    .select("rooms(*)")
                    .eq("user_id", user.id)
                    .eq("status", "accepted");

               if (error) {
                    console.error("Error fetching rooms:", error);
                    toast.error("Failed to fetch rooms");
                    if (isMounted.current) {
                         setAvailableRooms([]);
                         setRooms([]);
                    }
                    return;
               }

               let rooms = (roomsData as RoomMemberRow[])
                    .map((item) => item.rooms)
                    .filter((room): room is Room => room !== null);

               // If no rooms are found, look for or create "General Chat"
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
                              .insert({ name: "General Chat", is_private: false, created_by: user.id })
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

                         // Automatically join the user to the new "General Chat"
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
                         // If "General Chat" exists, join the user if not already a member
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

               // Augment rooms with membership and participation status
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
                    useRoomStore.getState().initializeDefaultRoom();
               }
          } catch (error) {
               console.error("Error fetching rooms:", error);
               toast.error("Failed to fetch rooms");
               if (isMounted.current) {
                    setAvailableRooms([]);
                    setRooms([]);
               }
          }
     }, [user, supabase, checkRoomMembership, checkRoomParticipation, setAvailableRooms, setRooms, isMounted]);

     return { fetchAvailableRooms };
};