import { useState, useEffect } from 'react';
import { useRoomStore } from '@/lib/store/roomstore';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useUser } from '@/lib/store/user'; // Add this import

export interface IRoom {
     id: string;
     name: string;
     created_by: string | null; // Updated to allow null
     created_at: string;
     is_private: boolean;
}

interface IRoomParticipant {
     room_id: string;
     user_id: string;
     status: 'pending' | 'accepted' | 'rejected'; // Strict union type
     joined_at: string;
}

export default function RoomList() {
     const [userParticipations, setUserParticipations] = useState<IRoomParticipant[]>([]);
     const { rooms, setRooms, selectedRoom, setSelectedRoom } = useRoomStore();
     const supabase = supabaseBrowser();
     const user = useUser((state) => state.user); // Add this line to get user from store

     useEffect(() => {
          // Fetch rooms and user's participation status
          const fetchRoomsAndStatus = async () => {
               if (!user) return; // Add check for user

               const { data: roomsData } = await supabase
                    .from('rooms')
                    .select('*');

               const { data: participations } = await supabase
                    .from('room_participants')
                    .select('*')
                    .eq('user_id', user.id);

               if (roomsData) {
                    // Type assertion to match IRoom interface
                    setRooms(roomsData as IRoom[]);
               }

               if (participations) {
                    // Type assertion and mapping to ensure correct status type
                    const typedParticipations = participations.map(p => ({
                         ...p,
                         status: p.status as 'pending' | 'accepted' | 'rejected'
                    }));
                    setUserParticipations(typedParticipations);
               }
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
     }, [user]); // Add user to dependency array

     const handleJoinRoom = async (roomId: string) => {
          if (!user) {
               toast.error('You must be logged in to join a room');
               return;
          }

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