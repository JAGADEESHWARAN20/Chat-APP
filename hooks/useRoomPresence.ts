"use client";
import { useRoomContext } from "@/lib/store/RoomContext";
import { useMemo } from "react";

/**
 * Optimized hook for room presence that uses RoomContext state
 * No duplication - just reads from the centralized state
 */
export function useRoomPresence(roomId: string | null) {
  const { state } = useRoomContext();

  const presenceData = useMemo(() => {
    if (!roomId) return { onlineCount: 0, onlineUsers: [] };

    // First check roomPresence map (most reliable)
    const roomPresenceData = state.roomPresence[roomId];
    if (roomPresenceData) {
      return { onlineCount: roomPresenceData.onlineUsers, onlineUsers: [] };
    }

    // Fallback to room's onlineUsers field
    let room = null;
    if (state.selectedRoom?.id === roomId) {
      room = state.selectedRoom;
    } else {
      room = state.availableRooms.find((r) => r.id === roomId);
    }

    return { onlineCount: room?.onlineUsers || 0, onlineUsers: [] };
  }, [roomId, state.roomPresence, state.selectedRoom, state.availableRooms]);

  return {
    onlineCount: presenceData.onlineCount,
    onlineUsers: presenceData.onlineUsers,
    isLoading: state.isLoading,
    error: null,
    refreshPresence: () => {}, // No-op
  };
}
