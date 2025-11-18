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
  // JOIN ROOM
  // --------------------------------------------------------------------
  joinRoom: async (roomId) => {
    const supabase = getSupabaseBrowserClient();
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return false;

    const { data, error } = await supabase.rpc("join_room", {
      p_room_id: roomId,
      p_user_id: user.id,
    });

    if (error) {
      toast.error(error.message);
      return false;
    }

    const result = normalizeRpc(data);

    if (!result?.success) {
      toast.error(result?.message ?? "Join failed");
      return false;
    }

    if (result.action === "joined_public_room") {
      toast.success("Joined room");
    } else if (result.action === "join_request_sent") {
      toast.info("Join request sent");
    }

    await get().fetchRooms();
    const sel = get().rooms.find((r) => r.id === roomId);
    if (sel) set({ selectedRoom: sel });

    return true;
  },

  // --------------------------------------------------------------------
  // LEAVE ROOM
  // --------------------------------------------------------------------
  leaveRoom: async (roomId) => {
    const supabase = getSupabaseBrowserClient();
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return false;

    const { data, error } = await supabase.rpc("remove_from_room", {
      p_room_id: roomId,
      p_user_id: user.id,
    });

    if (error) {
      toast.error(error.message);
      return false;
    }

    const result = normalizeRpc(data);

    if (!result?.success) {
      toast.error(result?.message ?? "Failed to leave");
      return false;
    }

    if (result.action === "owner_deleted") {
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
  },
}));
