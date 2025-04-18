// components/RoomList.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { PlusCircle } from 'lucide-react';
import {
     Dialog,
     DialogContent,
     DialogDescription,
     DialogFooter,
     DialogHeader,
     DialogTitle,
     DialogTrigger,
     DialogClose, // Import DialogClose
} from "@/components/ui/dialog";
import { useRoomStore } from '@/lib/store/roomstore'; // We'll create this store next
import { useUser } from '@/lib/store/user'; // Assuming you still use this for user info

// Define the Room type based on your Supabase table
export interface IRoom {
     id: string;
     name: string;
     created_by: string | null;
     created_at: string;
}

export default function RoomList() {
     const user = useUser((state) => state.user);
     const { rooms, setRooms, setSelectedRoom, selectedRoom } = useRoomStore((state) => state);
     const [newRoomName, setNewRoomName] = useState('');
     const [isLoading, setIsLoading] = useState(false);
     const [isCreating, setIsCreating] = useState(false);
     const [isDialogOpen, setIsDialogOpen] = useState(false); // Control dialog visibility

     const supabase = supabaseBrowser();

     // Fetch rooms on mount or when user logs in
     useEffect(() => {
          const fetchRooms = async () => {
               setIsLoading(true);
               const { data, error } = await supabase
                    .from('rooms')
                    .select('*')
                    .order('created_at', { ascending: true });

               if (error) {
                    toast.error(`Failed to fetch rooms: ${error.message}`);
               } else {
                    setRooms(data || []);
                    // Optionally select the first room by default if none is selected
                    if (!selectedRoom && data && data.length > 0) {
                         // setSelectedRoom(data[0]); // Or leave it null until user clicks
                    }
               }
               setIsLoading(false);
          };

          if (user) { // Only fetch if user is logged in
               fetchRooms();
          } else {
               setRooms([]); // Clear rooms if user logs out
               setSelectedRoom(null);
          }

          // Listen for new rooms added via Realtime (optional but nice)
          const channel = supabase
               .channel('public:rooms')
               .on<IRoom>(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'rooms' },
                    (payload) => {
                         console.log('New room detected:', payload.new);
                         setRooms([...rooms, payload.new]); // Add the new room to the list
                    }
               )
               // Add listeners for DELETE/UPDATE if needed
               .subscribe();

          return () => {
               supabase.removeChannel(channel);
          };

     }, [user, supabase, setRooms, setSelectedRoom, selectedRoom, rooms]); // Added rooms to dependencies for realtime update

     const handleCreateRoom = async () => {
          if (!newRoomName.trim()) {
               toast.error('Room name cannot be empty');
               return;
          }
          if (!user) {
               toast.error('You must be logged in to create a room.');
               return;
          }

          setIsCreating(true);
          try {
               const response = await fetch('/api/rooms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newRoomName.trim() }),
               });

               if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
               }

               const createdRoom: IRoom = await response.json();
               // No need to manually add here if realtime listener works,
               // but doing it provides immediate feedback
               if (!rooms.some(room => room.id === createdRoom.id)) {
                    setRooms([...rooms, createdRoom]);
               }
               toast.success(`Room "${createdRoom.name}" created!`);
               setNewRoomName('');
               setIsDialogOpen(false); // Close dialog on success

          } catch (error: any) {
               toast.error(`Failed to create room: ${error.message}`);
          } finally {
               setIsCreating(false);
          }
     };

     if (!user) return null; // Don't show rooms if not logged in

     return (
          <div className="w-64 border-r p-4 flex flex-col gap-4 bg-secondary/50">
               <div className='flex justify-between items-center'>
                    <h2 className="text-xl font-semibold">Rooms</h2>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                         <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className='text-muted-foreground'>
                                   <PlusCircle size={20} />
                              </Button>
                         </DialogTrigger>
                         <DialogContent>
                              <DialogHeader>
                                   <DialogTitle>Create New Room</DialogTitle>
                                   <DialogDescription>
                                        Enter a name for your new chat room.
                                   </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                   <Input
                                        id="name"
                                        placeholder="e.g., General Discussion"
                                        value={newRoomName}
                                        onChange={(e) => setNewRoomName(e.target.value)}
                                        disabled={isCreating}
                                   />
                              </div>
                              <DialogFooter>
                                   <DialogClose asChild>
                                        <Button variant="outline" disabled={isCreating}>Cancel</Button>
                                   </DialogClose>
                                   <Button onClick={handleCreateRoom} disabled={isCreating}>
                                        {isCreating ? 'Creating...' : 'Create Room'}
                                   </Button>
                              </DialogFooter>
                         </DialogContent>
                    </Dialog>
               </div>


               {isLoading ? (
                    <p>Loading rooms...</p>
               ) : (
                    <ul className="space-y-2 overflow-y-auto flex-1">
                         {rooms.length === 0 && <p className='text-muted-foreground text-sm'>No rooms yet. Create one!</p>}
                         {rooms.map((room) => (
                              <li key={room.id}>
                                   <Button
                                        variant={selectedRoom?.id === room.id ? 'secondary' : 'ghost'}
                                        className="w-full justify-start"
                                        onClick={() => setSelectedRoom(room)}
                                   >
                                        {room.name}
                                   </Button>
                              </li>
                         ))}
                    </ul>
               )}
          </div>
     );
}