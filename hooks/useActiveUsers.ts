"use client";
import { useRoomContext } from "@/lib/store/RoomContext";

/**
 * Simplified active users hook using RoomContext
 */
export function useActiveUsers(roomId: string | null) {
  const { getOnlineCount } = useRoomContext();
  
  return roomId ? getOnlineCount(roomId) : 0;
}