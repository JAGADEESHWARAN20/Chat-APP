"use client";

import { useState, useEffect } from 'react';
import { useRoomStore } from '@/lib/store/roomstore';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useUser } from '@/lib/store/user';
import { IRoom, IRoomParticipant } from '@/lib/types/rooms';

export default function RoomList() {
     const [userParticipations, setUserParticipations] = useState<IRoomParticipant[]>([]);
     const { rooms, setRooms, selectedRoom, setSelectedRoom } = useRoomStore();
     const supabase = supabaseBrowser();
     const user = useUser((state) => state.user);

     useEffect(() => {
          if (!user) return;

          const fetchRooms = async () => {
               try {
                    // Fetch rooms where the user is a member or public rooms
                    const { data: roomsData, error } = await supabase
                         .from('rooms')
                         .select('id, name, is_private, created_by')
                         .or(`is_private.eq.false, id.in((
                        SELECT room_id FROM room_members 
                        WHERE user_id = '${user.id}' AND status = 'accepted'
                    ))`);

                    if (error) {
                         toast.error('Failed to fetch rooms');
                         console.error('Error fetching rooms:', error);
                         return;
                    }

                    if (roomsData) {
                         setRooms(roomsData as IRoom[]);
                    }
               } catch (err) {
                    toast.error('Unexpected error fetching rooms');
                    console.error('Unexpected error:', err);
               }
          };

          fetchRooms();

          const roomChannel = supabase
               .channel('room_changes')
               .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'rooms' },
                    () => fetchRooms()
               )
               .subscribe();

          return () => {
               supabase.removeChannel(roomChannel);
          };
     }, [user, supabase, setRooms]);

     useEffect(() => {
          if (!user) return;

          const fetchParticipations = async () => {
               try {
                    const { data: participations, error } = await supabase
                         .from('room_participants')
                         .select('*')
                         .eq('user_id', user.id);

                    if (error) {
                         toast.error('Failed to fetch participations');
                         console.error('Error fetching participations:', error);
                         return;
                    }

                    if (participations) {
                         const typedParticipations = participations.map(p => ({
                              ...p,
                              status: p.status as 'pending' | 'accepted' | 'rejected'
                         }));
                         setUserParticipations(typedParticipations);
                    }
               } catch (err) {
                    toast.error('Unexpected error fetching participations');
                    console.error('Unexpected error:', err);
               }
          };

          fetchParticipations();

          const channel = supabase
               .channel('room_participants_changes')
               .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'room_participants' },
                    () => fetchParticipations()
               )
               .subscribe();

          return () => {
               supabase.removeChannel(channel);
          };
     }, [user, supabase]);

     const handleJoinRoom = async (roomId: string) => {
          if (!user) {
               toast.error('You must be logged in to join a room');
               return;
          }

          try {
               const response = await fetch(`/api/rooms/${roomId}/join`, {
                    method: 'POST',
               });

               if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to join room');
               }

               const data = await response.json();
               toast.success(
                    data.status === 'pending'
                         ? 'Join request sent'
                         : 'Joined room successfully'
               );
          } catch (error) {
               toast.error(error instanceof Error ? error.message : 'Failed to join room');
          }
     };

     const canJoinRoom = (room: IRoom) => {
          const participation = userParticipations.find(p => p.room_id === room.id);
          return !participation || participation.status === 'rejected';
     };

     if (!user) {
          return (
               <div className="w-64 border-r p-4">
                    <p className="text-muted-foreground">Please login to view rooms</p>
               </div>
          );
     }

     return (
          <div className="w-64 border-r p-4">
               <h2 className="text-xl font-bold mb-4">Rooms</h2>
               <div className="space-y-2">
                    {rooms.map(room => {
                         const participation = userParticipations.find(
                              p => p.room_id === room.id
                         );

                         return (
                              <div key={room.id} className="flex justify-between items-center">
                                   <Button
                                        variant={selectedRoom?.id === room.id ? 'secondary' : 'ghost'}
                                        className="w-full justify-start"
                                        onClick={() => {
                                             if (participation?.status === 'accepted') {
                                                  setSelectedRoom(room);
                                             }
                                        }}
                                        disabled={!participation || participation.status !== 'accepted'}
                                   >
                                        <span className="truncate">
                                             {room.name}
                                             {room.is_private && ' 🔒'}
                                        </span>
                                   </Button>

                                   {canJoinRoom(room) && (
                                        <Button
                                             size="sm"
                                             onClick={() => handleJoinRoom(room.id)}
                                        >
                                             Join
                                        </Button>
                                   )}

                                   {participation?.status === 'pending' && (
                                        <span className="text-sm text-muted-foreground">
                                             Pending
                                        </span>
                                   )}
                              </div>
                         );
                    })}
               </div>
          </div>
     );
}