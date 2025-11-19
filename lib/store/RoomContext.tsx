// lib/store/roomstore.ts
"use client";

import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { JoinRoomErrorResponse, JoinRoomSuccessResponse } from "@/lib/types/rpc"; // adjust path if needed

// ---------------------- Types ----------------------
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

// -------------------- Store interface --------------------
interface RoomState {
  user: any | null;
  selectedRoomId: string | null; // consistent: string | null

  availableRooms: Room[];

  typingUsers: TypingUser[];
  typingDisplayText: string;
  roomPresence: Record<string, RoomPresence>;
  isLoading: boolean;
  error: string | null;

  setUser: (user: any | null) => void;
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

  createRoom: (name: string, isPrivate: boolean) => Promise<Room | null>;
}

// -------------------- Helpers --------------------
const normalizeRooms = (data: any): Room[] =>
  (Array.isArray(data) ? data : []).map((r: any) => ({
    id: r.id,
    name: r.name,
    is_private: !!r.is_private,
    created_by: r.created_by ?? null,
    created_at: r.created_at,
    isMember: !!r.is_member,
    participationStatus: r.participation_status ?? null,
    memberCount: Number(r.member_count ?? 0),
    onlineUsers: r.online_users ?? undefined,
    unreadCount: r.unread_count ?? undefined,
    latestMessage: r.latest_message ?? undefined,
  }));

// safe parse JSON
const safeJson = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

// -------------------- Store --------------------
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
      addRoom: (room) =>
        set((state) => ({ availableRooms: [...state.availableRooms, room] })),

      updateRoom: (roomId, updates) =>
        set((state) => ({
          availableRooms: state.availableRooms.map((room) =>
            room.id === roomId ? { ...room, ...updates } : room
          ),
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
          selectedRoomId: state.selectedRoomId === roomId ? null : state.selectedRoomId,
        })),

      updateTypingUsers: (users) => set({ typingUsers: users }),
      updateTypingText: (text) => set({ typingDisplayText: text }),

      updateRoomPresence: (roomId, presence) =>
        set((state) => ({ roomPresence: { ...state.roomPresence, [roomId]: presence } })),

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      // ---------------- fetchRooms ----------------
      fetchRooms: async () => {
        const supabase = getSupabaseBrowserClient();
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;

        try {
          set({ isLoading: true, error: null });

          const { data, error } = await supabase.rpc("get_rooms_with_counts", {
            p_user_id: user.id,
            p_query: undefined,
            p_include_participants: true,
          });

          if (error) {
            console.error("fetchRooms RPC error:", error);
            set({ error: error.message ?? "Failed to fetch rooms" });
            toast.error("Failed to fetch rooms");
            return;
          }

          const formatted = normalizeRooms(data);
          set({ availableRooms: formatted });

          // initialize default selected room if none
          const sel = get().selectedRoomId;
          if (!sel && formatted.length > 0) {
            const defaultRoom = formatted.find((r) => r.name === "General Chat") ?? formatted[0];
            set({ selectedRoomId: defaultRoom.id });
          }
        } catch (err: any) {
          console.error("fetchRooms error:", err);
          set({ error: err.message ?? "Failed to fetch rooms" });
          toast.error("Failed to fetch rooms");
        } finally {
          set({ isLoading: false });
        }
      },

      // ---------------- sendMessage ----------------
      sendMessage: async (roomId, text) => {
        try {
          const res = await fetch("/api/messages/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId, text }),
          });
          return res.ok;
        } catch {
          return false;
        }
      },

     

      // ---------------- createRoom ----------------
      createRoom: async (name, isPrivate) => {
        try {
          const res = await fetch("/api/rooms/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, isPrivate }),
          });

          const json = await safeJson(res);

          if (!res.ok || !json?.room) {
            toast.error(json?.error || "Room creation failed");
            return null;
          }

          // update cached rooms
          await get().fetchRooms();
          // return created room if found
          const created = get().availableRooms.find((r) => r.name === name) ?? null;
          if (created) {
            get().setSelectedRoomId(created.id);
            return created;
          }
          return null;
        } catch (err) {
          console.error("Create room error:", err);
          toast.error("Room creation failed");
          return null;
        }
      },
    }))
  )
);

// -------------------- Exports / helpers --------------------
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

export const useRoomActions = () =>
  useRoomStore((state) => ({
    setSelectedRoomId: state.setSelectedRoomId,
    sendMessage: state.sendMessage,
    fetchRooms: state.fetchRooms,
    createRoom: state.createRoom,

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
    onlineUsers: presence?.userIds ?? [],
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
