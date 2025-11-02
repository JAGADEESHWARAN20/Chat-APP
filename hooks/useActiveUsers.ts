"use client";
import { useRoomContext } from "@/lib/store/RoomContext";
import { useMemo } from "react";

/**
 * Optimized hook to get active (online) users count for a room
 * Uses centralized RoomContext state for consistency
 */
export function useActiveUsers(roomId: string | null): number {
  const { state } = useRoomContext();

  return useMemo(() => {
    if (!roomId) return 0;

    // First check roomPresence map (most reliable)
    const roomPresenceData = state.roomPresence[roomId];
    if (roomPresenceData) {
      return roomPresenceData.onlineUsers;
    }

    // Fallback to room's onlineUsers field
    let room = null;
    if (state.selectedRoom?.id === roomId) {
      room = state.selectedRoom;
    } else {
      room = state.availableRooms.find((r) => r.id === roomId);
    }

    return room?.onlineUsers ?? 0;
  }, [roomId, state.roomPresence, state.selectedRoom, state.availableRooms]);
}
