"use client";

import { useRoomContext } from "@/lib/store/RoomContext";

interface RoomActiveUsersProps {
  roomId: string;
  showZero?: boolean;
  compact?: boolean;
}

export function RoomActiveUsers({ roomId, showZero = false, compact = false }: RoomActiveUsersProps) {
  const { getRoomPresence } = useRoomContext();
  const { onlineUsers } = getRoomPresence(roomId);

  if (onlineUsers === 0 && !showZero) {
    return null;
  }

  if (compact) {
    return (
      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
        {onlineUsers} online
      </span>
    );
  }

  return (
    <span className="text-xs px-2 py-1 text-green-800 dark:text-green-100 bg-green-500/20 border border-green-500/30 rounded-full">
      {onlineUsers} online
    </span>
  );
}