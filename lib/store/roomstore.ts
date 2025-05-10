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
     setRooms: (rooms) => {
          console.log("Setting rooms:", rooms);
          set({ rooms });
          // Automatically initialize the default room after setting rooms
          get().initializeDefaultRoom();
     },
     setSelectedRoom: (room) => {
          console.log("Setting selectedRoom:", room);
          set({ selectedRoom: room });
     },
     initializeDefaultRoom: () => {
          const { rooms, selectedRoom } = get();
          if (rooms.length > 0 && !selectedRoom) {
               const defaultRoom = rooms.find((r) => r.name === "General Chat") || rooms[0];
               console.log("Initializing default room:", defaultRoom);
               set({ selectedRoom: defaultRoom });
          } else if (!rooms.length) {
               console.warn("No rooms available to initialize default room");
          } else {
               console.log("Selected room already set:", selectedRoom);
          }
     },
}));