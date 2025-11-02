"use client";
import { usePresence } from "@/hooks/usePresence";
import { useRoomContext } from "@/lib/store/RoomContext";

/**
 * Unified hook for room presence using real-time presence
 */
export function useRoomPresence(roomId: string | null) {
  const { state } = useRoomContext();
  
  const presence = usePresence({
    roomIds: roomId ? [roomId] : [],
    excludeSelf: false, // Include self in count for total active users
  });

  const onlineCount = roomId ? presence.onlineCounts.get(roomId) || 0 : 0;
  const onlineUsers = roomId ? presence.onlineUsers.get(roomId) || [] : [];

  // Also get from room state as fallback
  let room = null;
  if (state.selectedRoom?.id === roomId) {
    room = state.selectedRoom;
  } else {
    room = state.availableRooms.find(r => r.id === roomId);
  }

  return {
    onlineCount: onlineCount || room?.onlineUsers || 0,
    onlineUsers,
    isLoading: presence.isLoading || state.isLoading,
    error: presence.error,
    refreshPresence: () => {}, // No-op for now
  };
}