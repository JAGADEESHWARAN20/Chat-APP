// File: lib/store/roomStore.ts
"use client";

import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/lib/types/supabase";

type IRoomRow = Database["public"]["Tables"]["rooms"]["Row"];

export type RoomWithMembership = IRoomRow & {
  isMember: boolean;
  participationStatus: string | null;
  memberCount: number;
  participant_count?: number;
  online_users?: number;
  latestMessage?: string | null;
};

export interface RoomPresence {
  onlineUsers: number;
  userIds: string[];
  lastUpdated?: string;
}

interface RoomState {
  user: { id: string } | null;
  rooms: RoomWithMembership[];
  selectedRoomId: string | null | undefined;
  roomPresence: Record<string, RoomPresence>;
  isLoading: boolean;
  error: string | null;

  _pendingJoins: Set<string>;
  _pendingLeaves: Set<string>;

  setUser: (u: { id: string } | null) => void;
  setRooms: (rooms: RoomWithMembership[]) => void;
  setSelectedRoomId: (id: string | null | undefined) => void;
  setRoomPresence: (roomId: string, p: RoomPresence) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;

  fetchRooms: (opts?: { force?: boolean }) => Promise<RoomWithMembership[] | null>;
  joinRoom: (roomId: string) => Promise<boolean>;
  leaveRoom: (roomId: string) => Promise<boolean>;
  createRoom: (name: string, isPrivate: boolean) => Promise<RoomWithMembership | null>;
}

const normalizeRpcRooms = (data: any): RoomWithMembership[] =>
  (Array.isArray(data) ? data : []).map((r: any) => ({
    ...r,
    isMember: Boolean(r.is_member),
    participationStatus: r.participation_status ?? null,
    memberCount: Number(r.member_count ?? 0),
  }));

const safeJson = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const apiJoin = (roomId: string) =>
  fetch(`/api/rooms/${roomId}/join`, { method: "POST", headers: { "Content-Type": "application/json" } });

const apiLeave = (roomId: string) =>
  fetch(`/api/rooms/${roomId}/leave`, { method: "PATCH", headers: { "Content-Type": "application/json" } });

export const useRoomStore = create<RoomState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      user: null,
      rooms: [],
      selectedRoomId: undefined,
      roomPresence: {},
      isLoading: false,
      error: null,

      _pendingJoins: new Set<string>(),
      _pendingLeaves: new Set<string>(),

      setUser: (u) => set({ user: u }),
      setRooms: (rooms) => {
        set({ rooms });
        const sel = get().selectedRoomId;
        if (!sel && rooms.length > 0) {
          const defaultRoom = rooms.find((r) => r.name === "General Chat") ?? rooms[0];
          set({ selectedRoomId: defaultRoom?.id });
        }
      },
      setSelectedRoomId: (id) => set({ selectedRoomId: id }),
      setRoomPresence: (roomId, p) =>
        set((s) => ({ roomPresence: { ...s.roomPresence, [roomId]: p } })),
      setLoading: (v) => set({ isLoading: v }),
      setError: (v) => set({ error: v }),

      fetchRooms: async ({ force = false } = {}) => {
        const supabase = getSupabaseBrowserClient();
        let userId = get().user?.id;
        try {
          if (!userId) {
            const u = await supabase.auth.getUser();
            userId = u.data.user?.id ?? undefined;
            if (userId) set({ user: { id: userId } });
          }
          if (!userId) return null;
          if (!force && get().rooms.length > 0) return get().rooms;

          set({ isLoading: true, error: null });

          const { data, error } = await supabase.rpc("get_rooms_with_counts", {
            p_user_id: userId,
            p_query: undefined,
            p_include_participants: true,
          });

          if (error) {
            console.error("fetchRooms RPC error:", error);
            set({ error: error.message ?? "Failed to fetch rooms" });
            return null;
          }

          const formatted = normalizeRpcRooms(data);
          set({ rooms: formatted });
          return formatted;
        } catch (err: any) {
          console.error("fetchRooms error:", err);
          set({ error: err.message ?? "Failed to fetch rooms" });
          return null;
        } finally {
          set({ isLoading: false });
        }
      },

      joinRoom: async (roomId) => {
        if (get()._pendingJoins.has(roomId)) return false;
        get()._pendingJoins.add(roomId);

        const prevRooms = get().rooms;
        const prevIndex = prevRooms.findIndex((r) => r.id === roomId);
        const prevRoom = prevIndex >= 0 ? prevRooms[prevIndex] : null;

        const rollback = () => set({ rooms: prevRooms });

        try {
          // If room known and private -> only mark participationStatus pending locally
          if (prevRoom?.is_private) {
            set({
              rooms: prevRooms.map((r, i) =>
                i === prevIndex ? { ...r, participationStatus: "pending" } : r
              ),
            });
          } else if (prevRoom) {
            // public: optimistic member
            set({
              rooms: prevRooms.map((r, i) =>
                i === prevIndex
                  ? { ...r, isMember: true, participationStatus: "accepted", memberCount: (r.memberCount || 0) + 1 }
                  : r
              ),
            });
          }

          const res = await apiJoin(roomId);
          const json = await safeJson(res);

          if (!res.ok) {
            rollback();
            const msg = json?.error || json?.message || "Failed to join room";
            toast.error(msg);
            return false;
          }

          const status = json?.status ?? null;

          // Always fetch canonical state after join to sync counts & membership
          await get().fetchRooms({ force: true });

          if (status === "accepted") {
            // ensure accepted state
            set((state) => ({
              rooms: state.rooms.map((r) =>
                r.id === roomId ? { ...r, isMember: true, participationStatus: "accepted" } : r
              ),
              selectedRoomId: roomId,
            }));
            toast.success(json?.message || "Joined room");
            return true;
          } else if (status === "pending") {
            set((state) => ({
              rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, participationStatus: "pending" } : r)),
            }));
            toast.info(json?.message || "Join request sent — awaiting approval");
            return true;
          }

          // fallback
          toast.success(json?.message || "Request processed");
          return true;
        } catch (err: any) {
          rollback();
          console.error("joinRoom error:", err);
          toast.error("Failed to join room");
          return false;
        } finally {
          get()._pendingJoins.delete(roomId);
        }
      },

      leaveRoom: async (roomId) => {
        if (get()._pendingLeaves.has(roomId)) return false;
        get()._pendingLeaves.add(roomId);

        const prevRooms = get().rooms;
        const prevIndex = prevRooms.findIndex((r) => r.id === roomId);
        const prevRoom = prevIndex >= 0 ? prevRooms[prevIndex] : null;

        const rollback = () => set({ rooms: prevRooms });

        try {
          // optimistic
          if (prevRoom) {
            set({
              rooms: prevRooms.map((r, i) =>
                i === prevIndex
                  ? { ...r, isMember: false, participationStatus: null, memberCount: Math.max(0, r.memberCount - 1) }
                  : r
              ),
            });
            if (get().selectedRoomId === roomId) set({ selectedRoomId: null });
          }

          const res = await apiLeave(roomId);
          const json = await safeJson(res);

          if (!res.ok) {
            rollback();
            const msg = json?.error || json?.message || "Failed to leave room";
            toast.error(msg);
            return false;
          }

          const result = json ?? {};
          if (result.success === false) {
            rollback();
            toast.error(result.message || "Failed to leave room");
            return false;
          }

          // refresh canonical rooms
          await get().fetchRooms({ force: true });

          if (result.action === "owner_deleted" || result.deleted === true) {
            set({ selectedRoomId: null });
            toast.success(result.message || "Room deleted");
            return true;
          }

          if (result.action === "not_member") {
            toast.info(result.message || "Not a member");
            return true;
          }

          toast.success(result.message || "Left room");
          return true;
        } catch (err: any) {
          rollback();
          console.error("leaveRoom error:", err);
          toast.error("Failed to leave room");
          return false;
        } finally {
          get()._pendingLeaves.delete(roomId);
        }
      },

      createRoom: async (name, isPrivate) => {
        try {
          const res = await fetch("/api/rooms/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, isPrivate }),
          });
          const json = await safeJson(res);
          if (!res.ok) {
            toast.error(json?.error || "Failed to create room");
            return null;
          }

          await get().fetchRooms({ force: true });
          const created = get().rooms.find((r) => r.name === name) ?? null;
          if (created) {
            toast.success("Room created");
            return created;
          }
          return null;
        } catch (err: any) {
          console.error("createRoom error:", err);
          toast.error("Failed to create room");
          return null;
        }
      },
    }))
  )
);

/* selectors & helpers */
export const useAvailableRooms = () => useRoomStore((s) => s.rooms);
export const useSelectedRoom = () => useRoomStore((s) => s.rooms.find((r) => r.id === s.selectedRoomId) ?? null);
export const useRoomLoading = () => useRoomStore((s) => s.isLoading);
export const useRoomError = () => useRoomStore((s) => s.error);
export const useRoomPresence = () => useRoomStore((s) => s.roomPresence);

export const useRoomActions = () =>
  useRoomStore((s) => ({
    fetchRooms: s.fetchRooms,
    joinRoom: s.joinRoom,
    leaveRoom: s.leaveRoom,
    createRoom: s.createRoom,
    setSelectedRoomId: s.setSelectedRoomId,
  }));

export const getRoomPresence = (roomId: string) => {
  const p = useRoomStore.getState().roomPresence[roomId];
  return { onlineCount: p?.onlineUsers ?? 0, onlineUsers: p?.userIds ?? [] as string[] };
};

