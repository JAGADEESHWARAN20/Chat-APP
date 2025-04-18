import { create } from "zustand";
import { Database } from "@/lib/types/supabase";

type IRoom = Database["public"]["Tables"]["rooms"]["Row"];

interface RoomState {
     rooms: IRoom[];
     selectedRoom: IRoom | null;
     setRooms: (rooms: IRoom[]) => void;
     setSelectedRoom: (room: IRoom | null) => void;
     initializeDefaultRoom: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
     rooms: [],
     selectedRoom: null,
     setRooms: (rooms) => set({ rooms }),
     setSelectedRoom: (room) => set({ selectedRoom: room }),
     initializeDefaultRoom: () => {
          const { rooms, selectedRoom } = get();
          if (rooms.length > 0 && !selectedRoom) {
               const defaultRoom = rooms.find((r) => r.name === "General") || rooms[0];
               set({ selectedRoom: defaultRoom });
          }
     },
}));