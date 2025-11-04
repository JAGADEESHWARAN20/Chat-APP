"use client";
import { useRoomStore } from '@/lib/store/RoomContext';
import { useMemo } from 'react';

export function useRoomPresence(roomId: string | null) {
  const roomPresence = useRoomStore((state) => state.roomPresence);
  const availableRooms = useRoomStore((state) => state.availableRooms);
  const isLoading = useRoomStore((state) => state.isLoading);

  const presenceData = useMemo(() => {
    if (!roomId) return { onlineCount: 0, onlineUsers: [] };

    // 1) Check real-time presence map first (most reliable)
    const livePresence = roomPresence[roomId];
    if (livePresence) {
      return {
        onlineCount: livePresence.onlineUsers,
        onlineUsers: livePresence.userIds || [],
      };
    }

    // 2) Fallback: check if we stored onlineUsers on room object
    const room = availableRooms.find((r) => r.id === roomId);
    return {
      onlineCount: room?.onlineUsers ?? 0,
      onlineUsers: [],
    };
  }, [roomId, roomPresence, availableRooms]);

  return {
    ...presenceData,
    isLoading,
    error: null,
    refreshPresence: () => {}, // (Presence is handled centrally)
  };
}
