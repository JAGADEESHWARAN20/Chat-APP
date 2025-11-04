"use client";
import { useRoomStore } from '@/lib/store/RoomContext';
import { useMemo } from 'react';

export function useActiveUsers(roomId: string | null): number {
  const roomPresence = useRoomStore((state) => state.roomPresence);
  const availableRooms = useRoomStore((state) => state.availableRooms);

  return useMemo(() => {
    if (!roomId) return 0;

    // If real-time presence exists — use it first (most accurate)
    const livePresence = roomPresence[roomId];
    if (livePresence) return livePresence.onlineUsers;

    // Otherwise fallback to stored room data
    const room = availableRooms.find((r) => r.id === roomId);
    return room?.onlineUsers ?? 0;
  }, [roomId, roomPresence, availableRooms]);
}
