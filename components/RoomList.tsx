import { useState, useEffect } from 'react';
import { useRoomStore } from '@/lib/store/roomstore';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from './ui/button';
import { toast } from 'sonner';

export interface IRoom {
     id: string;
     name: string;
     created_by: string;
     created_at: string;
     is_private: boolean;
}

interface IRoomParticipant {
     room_id: string;
     user_id: string;
     status: 'pending' | 'accepted' | 'rejected';
}

export default function RoomList() {
     const [userParticipations, setUserParticipations] = useState<IRoomParticipant[]>([]);
     const { rooms, setRooms, selectedRoom, setSelectedRoom } = useRoomStore();
     const supabase = supabaseBrowser();

     useEffect(() => {
          // Fetch rooms and user's participation status
          const fetchRoomsAndStatus = async () => {
               const { data: roomsData } = await supabase
                    .from('rooms')
                    .select('*');

               const { data: participations } = await supabase
                    .from('room_participants')
                    .select('*')
                    .eq('user_id', user?.id);

               if (roomsData) setRooms(roomsData);
               if (participations) setUserParticipations(participations);
          };

          fetchRoomsAndStatus();

          // Subscribe to room_participants changes
          const channel = supabase
               .channel('room_participants_changes')
               .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'room_participants' },
                    (payload) => {
                         fetchRoomsAndStatus();
                    })
               .subscribe();

          return () => {
               supabase.removeChannel(channel);
          };
     }, []);

     const handleJoinRoom = async (roomId: string) => {
          try {
               const response = await fetch(`/api/rooms/${roomId}/join`, {
                    method: 'POST',
               });

               if (!response.ok) throw new Error('Failed to join room');

               const data = await response.json();
               toast.success(
                    data.status === 'pending'
                         ? 'Join request sent'
                         : 'Joined room successfully'
               );
          } catch (error) {
               toast.error('Failed to join room');
          }
     };

     const canJoinRoom = (room: IRoom) => {
          const participation = userParticipations.find(p => p.room_id === room.id);
          return !participation || participation.status === 'rejected';
     };

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