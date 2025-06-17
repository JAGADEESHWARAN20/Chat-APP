"use client";

import { useRef, useEffect } from "react";
import { useRoomStore } from "./roomstore";
import { IRoom } from "@/lib/types/rooms";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useUser } from "@/lib/store/user";

function InitRoom({ rooms }: { rooms: IRoom[] }) {
     const initState = useRef(false);
     const user = useUser((state) => state.user);
     const supabase = supabaseBrowser();

     useEffect(() => {
          if (!initState.current && user) {
               const transformRooms = async () => {
                    try {
                         const { data: participations } = await supabase
                              .from('room_participants')
                              .select('*')
                              .eq('user_id', user.id);

                         const transformedRooms = rooms.map(room => ({
                              ...room,
                              isMember: participations?.some(p => p.room_id === room.id && p.status === 'accepted') || false,
                              participationStatus: participations?.find(p => p.room_id === room.id)?.status || null
                         }));

                         useRoomStore.setState({ rooms: transformedRooms });
                    } catch (error) {
                         console.error('Error transforming rooms:', error);
                    }
               };

               transformRooms();
          }
          initState.current = true;
     }, [rooms, user, supabase]);

     return null;
}

export default InitRoom;