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
                // First, check if default room exists with better error handling
                const { data: existingRoom, error: checkError } = await supabase
                    .from('rooms')
                    .select('id, name, is_private, created_by, created_at')
                    .eq('name', 'General Chat')
                    .single();

                if (checkError) {
                    console.error('Error checking for General Chat:', checkError);
                    throw checkError;
                }

                if (!existingRoom) {
                    // Create default room
                    const { data: newRoom, error: createError } = await supabase
                        .from('rooms')
                        .insert([
                            {
                                name: 'General Chat',
                                is_private: false,
                                created_by: user.id,
                                created_at: '2025-04-18 07:14:14'
                            }
                        ])
                        .select('id, name, is_private, created_by, created_at')
                        .single();

                    if (createError) {
                        console.error('Error creating General Chat:', createError);
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
                                    joined_at: '2025-04-18 07:14:14'
                                }
                            ]);

                        if (memberError) {
                            console.error('Error adding room member:', memberError);
                            throw memberError;
                        }
                    }
                }

                // Load all rooms with simplified query
                const { data: roomsData, error: loadError } = await supabase
                    .from('rooms')
                    .select(`
                        id,
                        name,
                        is_private,
                        created_by,
                        created_at
                    `)
                    .eq('is_private', false)
                    .order('created_at', { ascending: true });

                if (loadError) {
                    console.error('Error loading rooms:', loadError);
                    throw loadError;
                }

                if (roomsData) {
                    // Transform and validate the data
                    const transformedRooms: IRoom[] = roomsData
                        .filter(room => room.created_by) // Remove any rooms with null created_by
                        .map(room => ({
                            id: room.id,
                            name: room.name,
                            is_private: room.is_private,
                            created_by: room.created_by!,
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

        // Subscribe to room changes with error handling
        const roomChannel = supabase.channel('room_changes')
            .on('postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'rooms'
                },
                (payload) => {
                    console.log('Room change detected:', payload);
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