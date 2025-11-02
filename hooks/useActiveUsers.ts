"use client";
import { usePresence } from "@/hooks/usePresence";
import { useRoomContext } from "@/lib/store/RoomContext";

/**
 * Hook to get active (online) users count for a room using real-time presence
 */
export function useActiveUsers(roomId: string | null) {
  const { state } = useRoomContext();
  
  const presence = usePresence({
    roomIds: roomId ? [roomId] : [],
    excludeSelf: false, // Include self in count for total active users
  });
  
  // Get from real-time presence first, fallback to room state
  const realtimeCount = roomId ? presence.onlineCounts.get(roomId) || 0 : 0;
  
  if (!roomId) return 0;
  
  // Fallback to room state if real-time count is 0
  if (realtimeCount > 0) return realtimeCount;
  
  // Try to get online count from selected room if it matches
  if (state.selectedRoom?.id === roomId) {
    return state.selectedRoom.onlineUsers ?? 0;
  }
  
  // Try to get online count from available rooms
  const room = state.availableRooms.find(r => r.id === roomId);
  return room?.onlineUsers ?? 0;
}