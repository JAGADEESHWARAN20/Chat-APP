import { create } from 'zustand';
import { IRoom } from '@/lib/types/rooms';

interface RoomState {
     rooms: IRoom[];
     selectedRoom: IRoom | null;
     setRooms: (rooms: IRoom[]) => void;
     setSelectedRoom: (room: IRoom | null) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
     rooms: [],
     selectedRoom: null,
     setRooms: (rooms) => set({ rooms }),
     setSelectedRoom: (room) => set({ selectedRoom: room })
}));