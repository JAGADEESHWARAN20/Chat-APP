// hooks/useRoomActions.tsx
"use client";
import { useUnifiedRoomStore } from '@/lib/store/roomstore';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export function useRoomActions() {
  return useUnifiedRoomStore((state) => ({
    // ✅ All methods now exist in the unified store
    setSelectedRoomId: state.setSelectedRoomId,
    sendMessage: state.sendMessage,
    fetchRooms: state.fetchRooms,
    createRoom: state.createRoom,
    updateTypingUsers: state.updateTypingUsers,
    mergeRoomMembership: state.mergeRoomMembership,
    updateTypingText: state.updateTypingText,
    
    // Additional methods you might need
    joinRoom: state.joinRoom,
    leaveRoom: state.leaveRoom,
    refreshRooms: state.refreshRooms,
    updateRoomMembership: state.updateRoomMembership,
    setUser: state.setUser,
    setAvailableRooms: state.setAvailableRooms,
    addRoom: state.addRoom,
    updateRoom: state.updateRoom,
    removeRoom: state.removeRoom,
    setRoomPresence: state.setRoomPresence,
    setLoading: state.setLoading,
    setError: state.setError,
    clearError: state.clearError,
    
    // Helper function
    fetchAllUsers: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, created_at");
      return data || [];
    },
  }));
}