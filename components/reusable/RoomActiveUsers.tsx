"use client";
import { useRoomContext } from "@/lib/store/RoomContext";
import { useMemo } from "react";

interface RoomActiveUsersProps {
  roomId: string;
}

/**
 * Optimized component to display active users count
 * Reads directly from RoomContext without extra subscriptions
 */
export function RoomActiveUsers({ roomId }: RoomActiveUsersProps) {
  const { state } = useRoomContext();

  const onlineUsers = useMemo(() => {
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

  // Don't render if no online users
  if (onlineUsers === 0) {
    return null;
  }

  return (
    <span className="text-[0.8em] px-2 py-1 text-center text-green-800 dark:text-white bg-green-500/20 dark:bg-green-500/20 border border-green-500/30 dark:border-green-500/30 rounded-full">
      {onlineUsers} online
    </span>
  );
}
