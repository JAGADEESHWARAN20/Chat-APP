"use client";
import { useRoomStore } from '@/lib/store/RoomContext';
import { useMemo } from 'react';

/**
 * Optimized hook to get active (online) users count for a room
 * Uses centralized RoomContext state for consistency
 */
export function useActiveUsers(roomId: string | null): number {
  const roomPresence = useRoomStore((state) => state.roomPresence);
  const availableRooms = useRoomStore((state) => state.availableRooms);
  const selectedRoom = useRoomStore((state) => state.selectedRoom);

  return useMemo(() => {
    if (!roomId) return 0;

    // First check roomPresence map (most reliable)
    const roomPresenceData = roomPresence[roomId];
    if (roomPresenceData) {
      return roomPresenceData.onlineUsers;
    }

    // Fallback to room's onlineUsers field
    let room = null;
    if (selectedRoom?.id === roomId) {
      room = selectedRoom;
    } else {
      room = availableRooms.find((r: any) => r.id === roomId);
    }

    return room?.onlineUsers ?? 0;
  }, [roomId, roomPresence, selectedRoom, availableRooms]);
}