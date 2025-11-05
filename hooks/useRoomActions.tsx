"use client";
import { useRoomStore } from '@/lib/store/RoomContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export function useRoomActions() {
  return useRoomStore((state) => ({
    setSelectedRoom: state.setSelectedRoomId,
    sendMessage: state.sendMessage,
    fetchRooms: state.fetchRooms,
    createRoom: state.createRoom,
    leaveRoom: state.leaveRoom,
    joinRoom: state.joinRoom,
    updateTypingUsers: state.updateTypingUsers,
    mergeRoomMembership: state.mergeRoomMembership,
    updateTypingText: state.updateTypingText,
    fetchAllUsers: async () => {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, created_at");
        return data || [];
      },
  }));
}