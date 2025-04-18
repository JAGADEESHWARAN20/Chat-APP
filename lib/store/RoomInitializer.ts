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
                         .single();

                    if (!existingRoom && !checkError) {
                         // Create default room
                         const { data: newRoom, error: createError } = await supabase
                              .from('rooms')
                              .insert([
                                   {
                                        name: 'General Chat',
                                        is_private: false,
                                        created_by: user.id,
                                        created_at: '2025-04-18 06:59:08'
                                   }
                              ])
                              .select()
                              .single();

                         if (createError) {
                              throw createError;
                         }

                         if (newRoom) {
                              // Add creator as room member
                              const { error: memberError } = await supabase
                                   .from('room_members')
                                   .insert([
                                        {
                                             room_id: newRoom.id,
                                             user_id: user.id,
                                             status: 'accepted',
                                             joined_at: '2025-04-18 06:59:08'
                                        }
                                   ]);

                              if (memberError) {
                                   throw memberError;
                              }
                         }
                    }

                    // Load all rooms
                    const { data: roomsData, error: loadError } = await supabase
                         .from('rooms')
                         .select(`
                        *,
                        room_members!inner (
                            status,
                            user_id
                        )
                    `)
                         .eq('room_members.user_id', user.id)
                         .eq('room_members.status', 'accepted')
                         .order('created_at', { ascending: true });

                    if (loadError) {
                         throw loadError;
                    }

                    if (roomsData) {
                         // Transform the data to match IRoom type
                         const transformedRooms: IRoom[] = roomsData.map(({ room_members, ...room }) => ({
                              id: room.id,
                              name: room.name,
                              is_private: room.is_private,
                              created_by: room.created_by || user.id, // Fallback to current user if null
                              created_at: room.created_at
                         }));

                         setRooms(transformedRooms);
                         initializeDefaultRoom();
                    }
               } catch (error) {
                    console.error('Error initializing rooms:', error);
                    toast.error('Failed to initialize rooms');
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
                    () => initializeRooms())
               .subscribe();

          return () => {
               supabase.removeChannel(roomChannel);
          };
     }, [user, setRooms, initializeDefaultRoom, supabase]);

     return null;
}