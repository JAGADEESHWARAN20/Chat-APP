// lib/store/roomStore.ts
import { create } from 'zustand';
import { IRoom } from '@/components/RoomList'; // Import the room type

interface RoomState {
     rooms: IRoom[];
     selectedRoom: IRoom | null;
     setRooms: (rooms: IRoom[]) => void;
     addRoom: (room: IRoom) => void; // Optional: For realtime updates
     setSelectedRoom: (room: IRoom | null) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
     rooms: [],
     selectedRoom: null,
     setRooms: (rooms) => set({ rooms }),
     addRoom: (room) => set((state) => ({ rooms: [...state.rooms, room] })),
     setSelectedRoom: (room) => set({ selectedRoom: room, /* Maybe clear messages here? */ }),
}));

