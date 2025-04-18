"use client";
import { useEffect } from 'react';
import { useRoomStore } from '@/lib/store/roomstore';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useUser } from '@/lib/store/user';
import { toast } from 'sonner';
import { IRoom } from '@/lib/types/rooms';

export default function RoomInitializer() {
     const { setRooms, initializeDefaultRoom } = useRoomStore();
     const user = useUser((state) => state.user);
     const supabase = supabaseBrowser();

     useEffect(() => {
          if (!user) return;

          const initializeRooms = async () => {
               try {
                    // First, check if default room exists
                    const { data: existingRoom, error: checkError } = await supabase
                         .from('rooms')
                         .select('*')
                         .eq('name', 'General Chat')
                         .maybeSingle();

                    if (checkError) {
                         console.error('Error checking for General Chat:', checkError);
                         throw checkError;
                    }

                    if (!existingRoom) {
                         // Create default room with timestamp
                         const timestamp = '2025-04-18 07:22:22';

                         // Create room
                         const { data: newRoom, error: createError } = await supabase
                              .from('rooms')
                              .insert({
                                   name: 'General Chat',
                                   is_private: false,
                                   created_by: user.id,
                                   created_at: timestamp
                              })
                              .select()
                              .single();

                         if (createError) {
                              console.error('Error creating General Chat:', createError);
                              throw createError;
                         }

                         if (newRoom) {
                              // Add creator as room member
                              const { error: memberError } = await supabase
                                   .from('room_members')
                                   .insert({
                                        room_id: newRoom.id,
                                        user_id: user.id,
                                        status: 'accepted',
                                        joined_at: timestamp
                                   });

                              if (memberError) {
                                   console.error('Error adding room member:', memberError);
                                   throw memberError;
                              }
                         }
                    }

                    // Load all rooms for the user
                    const { data: roomsData, error: loadError } = await supabase
                         .from('rooms')
                         .select(`
                        id,
                        name,
                        is_private,
                        created_by,
                        created_at,
                        room_members!inner (
                            status,
                            user_id
                        )
                    `)
                         .eq('room_members.user_id', user.id)
                         .eq('room_members.status', 'accepted');

                    if (loadError) {
                         console.error('Error loading rooms:', loadError);
                         throw loadError;
                    }

                    if (roomsData) {
                         // Filter out rooms with null created_by and transform the data
                         const transformedRooms: IRoom[] = roomsData
                              .filter(room => room.created_by !== null)
                              .map(room => ({
                                   id: room.id,
                                   name: room.name,
                                   is_private: room.is_private,
                                   created_by: room.created_by!, // We can safely use ! here because of the filter
                                   created_at: room.created_at
                              }));

                         setRooms(transformedRooms);
                         initializeDefaultRoom();
                    }
               } catch (error: any) {
                    console.error('Error initializing rooms:', error);
                    toast.error(error.message || 'Failed to initialize rooms');
               }
          };

          initializeRooms();

          // Subscribe to room changes
          const roomChannel = supabase.channel('room_changes')
               .on('postgres_changes',
                    {
                         event: '*',
                         schema: 'public',
                         table: 'rooms',
                         filter: `room_members.user_id=eq.${user.id}`
                    },
                    () => {
                         console.log('Room change detected, refreshing rooms...');
                         initializeRooms();
                    })
               .subscribe((status) => {
                    console.log('Room subscription status:', status);
               });

          return () => {
               supabase.removeChannel(roomChannel);
          };
     }, [user, setRooms, initializeDefaultRoom, supabase]);

     return null;
}