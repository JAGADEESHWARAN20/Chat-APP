"use client";
import { useEffect } from 'react';
import { useRoomStore } from '@/lib/store/roomstore';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useUser } from '@/lib/store/user';

export default function RoomInitializer() {
     const { setRooms, initializeDefaultRoom } = useRoomStore();
     const user = useUser((state) => state.user);
     const supabase = supabaseBrowser();

     useEffect(() => {
          if (!user) return;

          const loadRooms = async () => {
               const { data: rooms } = await supabase
                    .from('rooms')
                    .select('*')
                    .order('created_at', { ascending: true });

               if (rooms) {
                    setRooms(rooms);
                    initializeDefaultRoom();
               }
          };

          loadRooms();
     }, [user]);

     return null;
}