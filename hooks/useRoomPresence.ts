"use client";
import { useRoomContext } from "@/lib/store/RoomContext";

/**
 * Unified hook for room presence using RoomContext
 */
export function useRoomPresence(roomId: string | null) {
  const { state } = useRoomContext();
  
  if (!roomId) {
    return {
      onlineCount: 0,
      onlineUsers: [],
      isLoading: false,
      error: null,
      refreshPresence: () => {},
    };
  }
  
  // Try to get online count from selected room if it matches
  let room = null;
  if (state.selectedRoom?.id === roomId) {
    room = state.selectedRoom;
  } else {
    // Try to get from available rooms
    room = state.availableRooms.find(r => r.id === roomId);
  }
  
  const onlineCount = room?.onlineUsers ?? 0;
  
  return {
    onlineCount,
    onlineUsers: [], // Empty array since we don't have user list in this context
    isLoading: state.isLoading,
    error: null,
    refreshPresence: () => {}, // No-op since we don't have refresh functionality
  };
}