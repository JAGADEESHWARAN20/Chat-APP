"use client";
import { useRoomContext } from "@/lib/store/RoomContext";

/**
 * Simplified active users hook using RoomContext
 */
export function useActiveUsers(roomId: string | null) {
  const { state } = useRoomContext();
  
  if (!roomId) return 0;
  
  // Try to get online count from selected room if it matches
  if (state.selectedRoom?.id === roomId) {
    return state.selectedRoom.onlineUsers ?? 0;
  }
  
  // Try to get online count from available rooms
  const room = state.availableRooms.find(r => r.id === roomId);
  return room?.onlineUsers ?? 0;
}