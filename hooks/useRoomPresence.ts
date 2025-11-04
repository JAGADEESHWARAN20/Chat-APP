"use client";
import { useRoomStore } from '@/lib/store/RoomContext';
import { useMemo } from 'react';

/**
 * Optimized hook for room presence that uses RoomContext state
 * No duplication - just reads from the centralized state
 */
export function useRoomPresence(roomId: string | null) {
  const roomPresence = useRoomStore((state) => state.roomPresence);
  const availableRooms = useRoomStore((state) => state.availableRooms);
  const selectedRoom = useRoomStore((state) => state.selectedRoom);
  const isLoading = useRoomStore((state) => state.isLoading);

  const presenceData = useMemo(() => {
    if (!roomId) return { onlineCount: 0, onlineUsers: [] };

    // First check roomPresence map (most reliable)
    const roomPresenceData = roomPresence[roomId];
    if (roomPresenceData) {
      return { 
        onlineCount: roomPresenceData.onlineUsers, 
        onlineUsers: roomPresenceData.userIds || [] 
      };
    }

    // Fallback to room's onlineUsers field
    let room = null;
    if (selectedRoom?.id === roomId) {
      room = selectedRoom;
    } else {
      room = availableRooms.find((r: any) => r.id === roomId);
    }

    return { 
      onlineCount: room?.onlineUsers || 0, 
      onlineUsers: [] 
    };
  }, [roomId, roomPresence, selectedRoom, availableRooms]);

  return {
    onlineCount: presenceData.onlineCount,
    onlineUsers: presenceData.onlineUsers,
    isLoading: isLoading,
    error: null,
    refreshPresence: () => {}, // No-op - handled by context
  };
}