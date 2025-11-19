"use client";
import { useUnifiedRoomStore } from '@/lib/store/roomstore';
import { useMemo } from 'react';

export function useRoomPresence(roomId: string | null) {
  const roomPresence = useUnifiedRoomStore((state) => state.roomPresence);
  const rooms = useUnifiedRoomStore((state) => state.rooms); // ✅ Use 'rooms' not 'availableRooms'
  const isLoading = useUnifiedRoomStore((state) => state.isLoading);

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
    const room = rooms.find((r) => r.id === roomId);
    return {
      onlineCount: room?.online_users ?? 0, // ✅ Use 'online_users' (with underscore)
      onlineUsers: [],
    };
  }, [roomId, roomPresence, rooms]);

  return {
    ...presenceData,
    isLoading,
    error: null,
    refreshPresence: () => {}, // (Presence is handled centrally)
  };
}