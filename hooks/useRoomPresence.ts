"use client";
import { useRoomContext } from "@/lib/store/RoomContext";

/**
 * Unified hook for room presence using RoomContext
 */
export function useRoomPresence(roomId: string | null) {
  const { 
    presence, 
    getOnlineCount, 
    getOnlineUsers,
    refreshPresence 
  } = useRoomContext();

  const onlineCount = roomId ? getOnlineCount(roomId) : 0;
  const onlineUsers = roomId ? getOnlineUsers(roomId) : [];

  return {
    onlineCount,
    onlineUsers,
    isLoading: presence.isLoading,
    error: presence.error,
    refreshPresence,
  };
}