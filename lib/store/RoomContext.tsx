"use client";
import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { getSupabaseBrowserClient } from "../supabase/client";
import { toast } from "sonner";
import { JoinRoomErrorResponse, JoinRoomSuccessResponse } from "../types/rpc";



export interface Room {
  id: string;
  name: string;
  is_private: boolean;
  created_by: string | null;
  created_at: string;
  isMember: boolean;
  participationStatus: "pending" | "accepted" | null;
  memberCount: number;
  onlineUsers?: number;
  unreadCount?: number;
  latestMessage?: string;
}
type JoinRoomResponse = JoinRoomSuccessResponse | JoinRoomErrorResponse;

export interface Message {
  id: string;
  text: string;
  sender_id: string;
  created_at: string;
  is_edited: boolean;
  room_id: string | null;
  direct_chat_id: string | null;
  status: string | null;
  profiles?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    created_at: string | null;
    updated_at: string | null;
    bio: string | null;
  };
}

export interface TypingUser {
  user_id: string;
  is_typing: boolean;
  display_name?: string;
}

export interface RoomPresence {
  onlineUsers: number;
  userIds: string[];
  lastUpdated: string;
}

interface RoomState {
  user: any | null;
  selectedRoomId: string | null;

  availableRooms: Room[];

  typingUsers: TypingUser[];
  typingDisplayText: string;
  roomPresence: Record<string, RoomPresence>;
  isLoading: boolean;
  error: string | null;

  setUser: (user: any) => void;
  setSelectedRoomId: (id: string | null) => void;
  setAvailableRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  updateRoom: (roomId: string, updates: Partial<Room>) => void;
  removeRoom: (roomId: string) => void;
  mergeRoomMembership: (roomId: string, updates: Partial<Room>) => void;
  updateTypingUsers: (users: TypingUser[]) => void;
  updateTypingText: (text: string) => void;
  updateRoomPresence: (roomId: string, presence: RoomPresence) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  fetchRooms: () => Promise<void>;
  sendMessage: (roomId: string, text: string) => Promise<boolean>;
  joinRoom: (roomId: string) => Promise<boolean>;
  leaveRoom: (roomId: string) => Promise<boolean>;
  createRoom: (name: string, isPrivate: boolean) => Promise<Room | null>;
}

export const useRoomStore = create<RoomState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      user: null,
      selectedRoomId: null,
      availableRooms: [],
      
      typingUsers: [],
      typingDisplayText: "",
      roomPresence: {},
      isLoading: false,
      error: null,

      setUser: (user) => set({ user }),
      setSelectedRoomId: (id) => set({ selectedRoomId: id }),

      setAvailableRooms: (rooms) => set({ availableRooms: rooms }),
      addRoom: (room) => set((state) => ({
        availableRooms: [...state.availableRooms, room]
      })),

      updateRoom: (roomId, updates) =>
        set((state) => ({
          availableRooms: state.availableRooms.map((room) =>
            room.id === roomId ? { ...room, ...updates } : room
          )
        })),
      
      mergeRoomMembership: (roomId, updates) =>
        set((state) => ({
          availableRooms: state.availableRooms.map((room) =>
            room.id === roomId ? { ...room, ...updates } : room
          ),
        })),
      

      removeRoom: (roomId) =>
        set((state) => ({
          availableRooms: state.availableRooms.filter((room) => room.id !== roomId),
          selectedRoomId: state.selectedRoomId === roomId ? null : state.selectedRoomId
        })),

    

      updateTypingUsers: (users) => set({ typingUsers: users }),
      updateTypingText: (text) => set({ typingDisplayText: text }),

      updateRoomPresence: (roomId, presence) =>
        set((state) => ({
          roomPresence: {
            ...state.roomPresence,
            [roomId]: presence
          }
        })),

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      fetchRooms: async () => {
        const { user, setAvailableRooms, setLoading, setError } = get();
        const supabase = getSupabaseBrowserClient();
        if (!user) return;

        try {
          setLoading(true);

          const { data, error } = await supabase.rpc("get_rooms_with_counts", {
            p_user_id: user.id,
            p_query: undefined,
            p_include_participants: true,
          });

          if (error) throw error;

          const formattedRooms = (data || []).map((room: any): Room => ({
            id: room.id,
            name: room.name,
            is_private: room.is_private,
            created_by: room.created_by,
            created_at: room.created_at,
            isMember: room.is_member,
            participationStatus: room.participation_status,
            memberCount: room.member_count
          }));

          setAvailableRooms(formattedRooms);
        } catch (err: any) {
          console.error("fetchRooms error:", err);
          setError(err.message ?? "Failed to fetch rooms");
        } finally {
          setLoading(false);
        }
      },

   
      sendMessage: async (roomId, text) => {
        try {
          const res = await fetch("/api/messages/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId, text })
          });
      
          return res.ok;
        } catch {
          return false;
        }
      },
      
      
      
      joinRoom: async (roomId) => {
        const supabase = getSupabaseBrowserClient();
        const { fetchRooms, setSelectedRoomId } = get();
      
        try {
          const { data, error } = await supabase.rpc("join_room", {
            p_room_id: roomId,
            p_user_id: get().user.id
          }) as any;
      
          if (error) throw error;
          if (!data) return false;
      
          switch (data.action) {
            case "joined_public_room":
              toast.success("Joined room!");
              await fetchRooms();
              setSelectedRoomId(roomId); // ✅ auto-open
              return true;
      
            case "join_request_sent":
              toast.info("Join request sent to room owner");
              await fetchRooms();
              return true;
      
            case "owner_joined_private_room":
              toast.success("Welcome to your private room!");
              await fetchRooms();
              setSelectedRoomId(roomId);
              return true;
          }
      
          return true;
        } catch (err: any) {
          toast.error(err.message ?? "Failed to join room");
          return false;
        }
      },
      


      leaveRoom: async (roomId) => {
        const supabase = getSupabaseBrowserClient();
        const { fetchRooms, setSelectedRoomId } = get();
        try {
          const { error } = await supabase.rpc("leave_room", {
            p_room_id: roomId,
            p_user_id: get().user.id
          });
          if (error) throw error;
          if (get().selectedRoomId === roomId) setSelectedRoomId(null);
          await fetchRooms();
          return true;
        } catch {
          return false;
        }
      },

      createRoom: async (name, isPrivate) => {
        try {
          const res = await fetch("/api/rooms/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, isPrivate })
          });
          const json = await res.json();
          if (json.success && json.room) {
            get().addRoom(json.room);
            return json.room;
          }
          return null;
        } catch {
          return null;
        }
      }
    }))
  )
);

export function RoomProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export const useRoomContext = () => useRoomStore();

export const useSelectedRoom = () =>
  useRoomStore((state) =>
    state.availableRooms.find((room) => room.id === state.selectedRoomId) || null
  );

export const useAvailableRooms = () => useRoomStore((s) => s.availableRooms);
export const useRoomLoading = () => useRoomStore((s) => s.isLoading);
export const useRoomError = () => useRoomStore((s) => s.error);
export const useTypingUsers = () => useRoomStore((s) => s.typingUsers);
export const useTypingDisplayText = () => useRoomStore((s) => s.typingDisplayText);

export const useRoomActions = () => useRoomStore((state) => ({
  setSelectedRoomId: state.setSelectedRoomId,
  sendMessage: state.sendMessage,
  fetchRooms: state.fetchRooms,
  createRoom: state.createRoom,
  leaveRoom: state.leaveRoom,
  joinRoom: state.joinRoom,
  updateTypingUsers: state.updateTypingUsers,
  updateTypingText: state.updateTypingText,
  mergeRoomMembership: state.mergeRoomMembership,
  setUser: state.setUser,
  setAvailableRooms: state.setAvailableRooms,
  addRoom: state.addRoom,
  updateRoom: state.updateRoom,
  removeRoom: state.removeRoom,
  updateRoomPresence: state.updateRoomPresence,
  setLoading: state.setLoading,
  setError: state.setError,
  clearError: state.clearError,
}));



export const getRoomPresence = (roomId: string) => {
  const presence = useRoomStore.getState().roomPresence[roomId];
  return {
    onlineCount: presence?.onlineUsers ?? 0,
    onlineUsers: presence?.userIds ?? []
  };
};

export const useRoomPresence = () => useRoomStore((state) => state.roomPresence);

export const fetchAllUsers = async () => {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at");
  return data || [];
};

