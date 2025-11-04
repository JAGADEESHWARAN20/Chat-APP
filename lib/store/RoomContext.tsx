"use client";
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
// import { createContext, useContext } from 'react';
import { getSupabaseBrowserClient } from '../supabase/client';

export interface Room {
  id: string;
  name: string;
  is_private: boolean;
  created_by: string | null; // <--- CHANGE THIS
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
  // State
  user: any | null;
  selectedRoom: Room | null;
  availableRooms: Room[];
  messages: Message[];
  typingUsers: TypingUser[];
  typingDisplayText: string;
  roomPresence: Record<string, RoomPresence>;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: any) => void;
  setSelectedRoom: (room: Room | null) => void;
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
  
  // Async Actions
  fetchRooms: () => Promise<void>;
  fetchMessages: (roomId: string) => Promise<void>;
  sendMessage: (roomId: string, text: string) => Promise<boolean>;
  joinRoom: (roomId: string) => Promise<boolean>;
  leaveRoom: (roomId: string) => Promise<boolean>;
  createRoom: (name: string, isPrivate: boolean) => Promise<Room | null>;
}

// Zustand store
export const useRoomStore = create<RoomState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial state
      user: null,
      selectedRoom: null,
      availableRooms: [],
      messages: [],
      typingUsers: [],
      typingDisplayText: '',
      roomPresence: {},
      isLoading: false,
      error: null,

      // Sync actions
      setUser: (user) => set({ user }),
      
      setSelectedRoom: (room) => {
        set({ selectedRoom: room });
        if (room) {
          get().fetchMessages(room.id);
        }
      },
      
      setAvailableRooms: (rooms) => set({ availableRooms: rooms }),
      
      addRoom: (room) => set((state) => ({
        availableRooms: [...state.availableRooms, room]
      })),
      
      updateRoom: (roomId, updates) => set((state) => ({
        availableRooms: state.availableRooms.map(room =>
          room.id === roomId ? { ...room, ...updates } : room
        ),
        selectedRoom: state.selectedRoom?.id === roomId 
          ? { ...state.selectedRoom, ...updates }
          : state.selectedRoom
      })),
      
      removeRoom: (roomId) => set((state) => ({
        availableRooms: state.availableRooms.filter(room => room.id !== roomId),
        selectedRoom: state.selectedRoom?.id === roomId ? null : state.selectedRoom
      })),
      
      setMessages: (messages) => set({ messages }),
      
      addMessage: (message) => set((state) => ({
        messages: [message, ...state.messages]
      })),
      
      updateMessage: (messageId, updates) => set((state) => ({
        messages: state.messages.map(msg =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        )
      })),
      
      deleteMessage: (messageId) => set((state) => ({
        messages: state.messages.filter(msg => msg.id !== messageId)
      })),
      
      updateTypingUsers: (users) => set({ typingUsers: users }),
      
      updateTypingText: (text) => set({ typingDisplayText: text }),
      
      updateRoomPresence: (roomId, presence) => set((state) => ({
        roomPresence: {
          ...state.roomPresence,
          [roomId]: presence
        }
      })),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      setError: (error) => set({ error }),
      
      clearError: () => set({ error: null }),

      // Async actions
      fetchRooms: async () => {
        const { user, setAvailableRooms, setLoading, setError } = get();
        const supabase = getSupabaseBrowserClient();
      
        if (!user) return;
      
        try {
          setLoading(true);
      
          const { data, error } = await supabase.rpc("get_rooms_with_counts", {
            p_user_id: user.id,
            p_query: undefined,
            p_include_participants: true
          });

          if (error) throw error;
      
          const formattedRooms: Room[] = (data || []).map((room: any) => ({
            id: room.id,
            name: room.name,
            is_private: room.is_private,
            created_by: room.created_by,
            created_at: room.created_at,
            isMember: room.is_member,
            participationStatus: room.participation_status as 'accepted' | 'pending' | null,
            memberCount: room.member_count,
          }));
      
          setAvailableRooms(formattedRooms);
        } catch (err: any) {
          console.error("fetchRooms error:", err);
          setError(err.message ?? "Failed to fetch rooms");
        } finally {
          setLoading(false);
        }
      },
      
      fetchMessages: async (roomId: string) => {
        const { setLoading, setError, setMessages } = get();
        
        try {
          setLoading(true);
          const response = await fetch(`/api/messages/${roomId}`);
          const result = await response.json();
          
          if (!response.ok) {
            throw new Error(result.error || 'Failed to fetch messages');
          }
          
          if (result.success) {
            setMessages(result.messages || []);
          }
        } catch (error) {
          console.error('Failed to fetch messages:', error);
          setError(error instanceof Error ? error.message : 'Failed to fetch messages');
        } finally {
          setLoading(false);
        }
      },

      sendMessage: async (roomId: string, text: string): Promise<boolean> => {
        const { addMessage, user } = get();
        
        if (!user) return false;

        try {
          const optimisticMessage: Message = {
            id: `temp-${Date.now()}`,
            text,
            sender_id: user.id,
            created_at: new Date().toISOString(),
            is_edited: false,
            room_id: roomId,
            direct_chat_id: null,
            status: 'sending',
            profiles: {
              id: user.id,
              username: user.email?.split('@')[0] || 'User',
              display_name: user.email?.split('@')[0] || 'User',
              avatar_url: null,
              created_at: null,
              updated_at: null,
              bio: null
            }
          };

          addMessage(optimisticMessage);

          const response = await fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, text })
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Failed to send message');
          }

          if (result.success) {
            const { updateMessage, deleteMessage } = get();
            deleteMessage(optimisticMessage.id);
            addMessage(result.message);
            return true;
          }

          return false;
        } catch (error) {
          console.error('Failed to send message:', error);
          get().updateMessage(`temp-${Date.now()}`, { status: 'failed' });
          return false;
        }
      },

      joinRoom: async (roomId: string): Promise<boolean> => {
        const supabase = getSupabaseBrowserClient();
        const { fetchRooms } = get();
      
        try {
          const { error } = await supabase.rpc("join_room", {
            p_room_id: roomId,
            p_user_id: get().user.id,
            p_status: "pending" // Supabase will auto-approve public rooms
          });
      
          if (error) throw error;
      
          await fetchRooms();
          return true;
        } catch (err) {
          console.error("joinRoom failed:", err);
          return false;
        }
      },
      

      leaveRoom: async (roomId: string): Promise<boolean> => {
        const supabase = getSupabaseBrowserClient();
        const { fetchRooms, setSelectedRoom } = get();
      
        try {
          const { error } = await supabase.rpc("leave_room", {
            p_room_id: roomId,
            p_user_id: get().user.id
          });
      
          if (error) throw error;
      
          if (get().selectedRoom?.id === roomId) {
            setSelectedRoom(null);
          }
      
          await fetchRooms();
          return true;
        } catch (err) {
          console.error("leaveRoom error:", err);
          return false;
        }
      },
      

      createRoom: async (name: string, isPrivate: boolean): Promise<Room | null> => {
        try {
          const response = await fetch('/api/rooms/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, isPrivate })
          });
          
          const result = await response.json();
          
          if (result.success && result.room) {
            get().addRoom(result.room);
            return result.room;
          }
          
          return null;
        } catch (error) {
          console.error('Failed to create room:', error);
          return null;
        }
      }
    }))
  )
);

// React Context - Since we're using Zustand, we don't actually need React Context
// The RoomProvider is just a wrapper component now
export function RoomProvider({ children }: { children: React.ReactNode }) {
  // No need for context provider - Zustand handles global state
  return <>{children}</>;
}

// FIXED: useRoomContext now returns the full store state
export function useRoomContext() {
  // Directly use the Zustand store instead of context
  return useRoomStore();
}

// Direct store hooks for specific selectors (optimized)
export const useSelectedRoom = () => useRoomStore((state) => state.selectedRoom);
export const useAvailableRooms = () => useRoomStore((state) => state.availableRooms);
export const useRoomMessages = () => useRoomStore((state) => state.messages);
export const useRoomLoading = () => useRoomStore((state) => state.isLoading);
export const useRoomError = () => useRoomStore((state) => state.error);
export const useTypingUsers = () => useRoomStore((state) => state.typingUsers);
export const useTypingDisplayText = () => useRoomStore((state) => state.typingDisplayText);

export const useRoomActions = () => useRoomStore((state) => ({
  setSelectedRoom: state.setSelectedRoom,
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

export const useRoomSelection = () => useRoomStore((state) => ({
  setSelectedRoom: state.setSelectedRoom,
  setAvailableRooms: state.setAvailableRooms,
}));

export const useRoomMessagesActions = () => useRoomStore((state) => ({
  setMessages: state.setMessages,
  addMessage: state.addMessage,
  updateMessage: state.updateMessage,
  deleteMessage: state.deleteMessage,
  fetchMessages: state.fetchMessages,
  sendMessage: state.sendMessage,
}));

export const useRoomManagement = () => useRoomStore((state) => ({
  fetchRooms: state.fetchRooms,
  createRoom: state.createRoom,
  joinRoom: state.joinRoom,
  leaveRoom: state.leaveRoom,
}));

export const useTypingActions = () => useRoomStore((state) => ({
  updateTypingUsers: state.updateTypingUsers,
  updateTypingText: state.updateTypingText,
}));

export const useRoomPresence = () => useRoomStore((state) => state.roomPresence);

export const fetchAllUsers = async () => {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at");
  return data || [];
};

export const getRoomPresence = (roomId: string) => {
  const presence = useRoomStore.getState().roomPresence[roomId];
  return {
    onlineCount: presence?.onlineUsers ?? 0,
    onlineUsers: presence?.userIds ?? []
  };
};