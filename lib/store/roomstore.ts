"use client";

import { create } from "zustand";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type IRoom = Database["public"]["Tables"]["rooms"]["Row"];

export type RoomWithMembership = IRoom & {
  isMember: boolean;
  participationStatus: string | null;
  memberCount: number;
  participant_count?: number;
  online_users?: number;
};

interface RoomState {
  rooms: RoomWithMembership[];
  selectedRoom: RoomWithMembership | null;

  setRooms: (rooms: RoomWithMembership[]) => void;
  setSelectedRoom: (room: RoomWithMembership | null) => void;

  initializeDefaultRoom: () => void;

  fetchRooms: () => Promise<void>;
  joinRoom: (roomId: string) => Promise<boolean>;
  leaveRoom: (roomId: string) => Promise<boolean>;
}

const normalizeRpc = (data: any) => {
  if (!data) return null;
  return Array.isArray(data) ? data[0] : data;
};

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  selectedRoom: null,

  setRooms: (rooms) => {
    set({ rooms });
    get().initializeDefaultRoom();
  },

  setSelectedRoom: (room) => set({ selectedRoom: room }),

  initializeDefaultRoom: () => {
    const { rooms, selectedRoom } = get();
    if (rooms.length > 0 && !selectedRoom) {
      const defaultRoom =
        rooms.find((r) => r.name === "General Chat") || rooms[0];
      set({ selectedRoom: defaultRoom });
    }
  },

  // --------------------------------------------------------------------
  // FETCH ROOMS
  // --------------------------------------------------------------------
  fetchRooms: async () => {
    const supabase = getSupabaseBrowserClient();
    const user = (await supabase.auth.getUser()).data.user;

    if (!user) return;

    const { data, error } = await supabase.rpc("get_rooms_with_counts", {
     p_user_id: user.id,
     p_query: undefined,
     p_include_participants: true,
   });
   

    if (error) {
      toast.error("Failed to fetch rooms");
      return;
    }

    const formatted: RoomWithMembership[] =
      (data || []).map((r: any) => ({
        ...r,
        isMember: r.is_member,
        participationStatus: r.participation_status,
        memberCount: r.member_count,
      })) ?? [];

    get().setRooms(formatted);
  },

  // --------------------------------------------------------------------
  // JOIN ROOM (Fixed: Use API route instead of missing RPC)
  // --------------------------------------------------------------------
  joinRoom: async (roomId) => {
    const supabase = getSupabaseBrowserClient();
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return false;

    try {
      // Use API route (consistent with RoomList; avoids RPC issue)
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || "Join failed");
        return false;
      }

      const data = await response.json();
      if (data.status === "accepted") {
        toast.success("Joined room");
      } else if (data.status === "pending") {
        toast.info("Join request sent");
      } else {
        toast.error(data.message || "Join failed");
        return false;
      }

      await get().fetchRooms();
      const sel = get().rooms.find((r) => r.id === roomId);
      if (sel) set({ selectedRoom: sel });

      return true;
    } catch (error) {
      toast.error("Join failed");
      console.error("Join error:", error);
      return false;
    }
  },

  // --------------------------------------------------------------------
  // LEAVE ROOM (Fixed: Use API route instead of missing RPC)
  // --------------------------------------------------------------------
  leaveRoom: async (roomId) => {
    const supabase = getSupabaseBrowserClient();
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return false;

    try {
      // Use API route (consistent with RoomList; avoids RPC issue)
      const response = await fetch(`/api/rooms/${roomId}/leave`, {
        method: "PATCH",
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to leave");
        return false;
      }

      const data = await response.json();
      if (data.deleted) {
        toast.success("Room deleted");
      } else {
        toast.success("Left room");
      }

      await get().fetchRooms();

      const selected = get().selectedRoom;
      if (selected?.id === roomId) {
        set({ selectedRoom: null });
      }

      return true;
    } catch (error) {
      toast.error("Leave failed");
      console.error("Leave error:", error);
      return false;
    }
  },
}));