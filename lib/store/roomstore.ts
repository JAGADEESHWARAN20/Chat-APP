import { create } from 'zustand';

export interface IRoom {
     id: string;
     name: string;
     created_by: string;
     created_at: string;
     is_private: boolean;
}

interface RoomState {
     rooms: IRoom[];
     selectedRoom: IRoom | null;
     setRooms: (rooms: IRoom[]) => void;
     setSelectedRoom: (room: IRoom | null) => void;
     addRoom: (room: IRoom) => void;
     updateRoom: (roomId: string, updates: Partial<IRoom>) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
     rooms: [],
     selectedRoom: null,
     setRooms: (rooms) => set({ rooms }),
     setSelectedRoom: (room) => set({ selectedRoom: room }),
     addRoom: (room) => set((state) => ({
          rooms: [...state.rooms, room]
     })),
     updateRoom: (roomId, updates) => set((state) => ({
          rooms: state.rooms.map(room =>
               room.id === roomId ? { ...room, ...updates } : room
          )
     })),
}));