import { create } from 'zustand';
import { IRoom } from '@/lib/types/rooms';

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
     initializeDefaultRoom: async () => {
          const { rooms } = get();
          if (rooms.length > 0 && !get().selectedRoom) {
               // Select General room if it exists, otherwise select first room
               const defaultRoom = rooms.find(r => r.name === 'General') || rooms[0];
               set({ selectedRoom: defaultRoom });
          }
     }
}));