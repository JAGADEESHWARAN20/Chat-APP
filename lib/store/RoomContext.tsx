"use client";
import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { getSupabaseBrowserClient } from "../supabase/client";

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
  messages: Message[];
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

  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  deleteMessage: (messageId: string) => void;

  updateTypingUsers: (users: TypingUser[]) => void;
  updateTypingText: (text: string) => void;
  updateRoomPresence: (roomId: string, presence: RoomPresence) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  fetchRooms: () => Promise<void>;
  fetchMessages: (roomId: string) => Promise<void>;
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
      messages: [],
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

      removeRoom: (roomId) =>
        set((state) => ({
          availableRooms: state.availableRooms.filter((room) => room.id !== roomId),
          selectedRoomId: state.selectedRoomId === roomId ? null : state.selectedRoomId
        })),

      setMessages: (messages) => set({ messages }),
      addMessage: (message) => set((state) => ({
        messages: [message, ...state.messages]
      })),

      updateMessage: (messageId, updates) =>
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          )
        })),

      deleteMessage: (messageId) =>
        set((state) => ({
          messages: state.messages.filter((msg) => msg.id !== messageId)
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

      fetchMessages: async (roomId) => {
        const { setLoading, setError, setMessages } = get();
        try {
          setLoading(true);
          const res = await fetch(`/api/messages/${roomId}`);
          const json = await res.json();
          if (!res.ok) throw new Error(json.error);
          setMessages(json.messages || []);
        } catch (err: any) {
          setError(err.message ?? "Failed to load messages");
        } finally {
          setLoading(false);
        }
      },

      sendMessage: async (roomId, text) => {
        const { addMessage, user } = get();
        if (!user) return false;

        const optimisticMessage: Message = {
          id: `temp-${Date.now()}`,
          text,
          sender_id: user.id,
          created_at: new Date().toISOString(),
          is_edited: false,
          room_id: roomId,
          direct_chat_id: null,
          status: "sending",
        };

        addMessage(optimisticMessage);

        try {
          const res = await fetch("/api/messages/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId, text })
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error);
          get().deleteMessage(optimisticMessage.id);
          addMessage(json.message);
          return true;
        } catch {
          get().updateMessage(optimisticMessage.id, { status: "failed" });
          return false;
        }
      },

      joinRoom: async (roomId) => {
        const supabase = getSupabaseBrowserClient();
        const { fetchRooms, availableRooms } = get();
        
        try {
          // Get room info to determine if it's private
          const room = availableRooms.find(r => r.id === roomId);
          const isPrivateRoom = room?.is_private;
          
          console.log("🚀 joinRoom called:", {
            roomId,
            roomName: room?.name,
            isPrivate: isPrivateRoom,
            userId: get().user?.id
          });
          
          const { error, data } = await supabase.rpc("join_room", {
            p_room_id: roomId,
            p_user_id: get().user.id
          });
          
          console.log("📨 RPC Response:", { error, data });
          
          if (error) throw error;
          await fetchRooms();
          return true;
        } catch (err: any) {
          console.error("❌ joinRoom error:", err);
          get().setError(err.message ?? "Failed to join room");
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
export const useRoomMessages = () => useRoomStore((s) => s.messages);
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
  setUser: state.setUser,
  setAvailableRooms: state.setAvailableRooms,
  addRoom: state.addRoom,
  updateRoom: state.updateRoom,
  removeRoom: state.removeRoom,
  setMessages: state.setMessages,
  addMessage: state.addMessage,
  updateMessage: state.updateMessage,
  deleteMessage: state.deleteMessage,
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

