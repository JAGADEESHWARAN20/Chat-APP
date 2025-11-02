// components/reusable/RoomActiveUsers.tsx
"use client";

import { useRoomContext } from "@/lib/store/RoomContext";
import { useEffect, useState } from "react";

interface RoomActiveUsersProps {
  roomId: string;
}

export function RoomActiveUsers({ roomId }: RoomActiveUsersProps) {
  const { state } = useRoomContext();
  const [onlineUsers, setOnlineUsers] = useState(0);

  useEffect(() => {
    // Get online users from room presence data
    const roomPresence = state.roomPresence[roomId];
    if (roomPresence) {
      setOnlineUsers(roomPresence.onlineUsers);
    } else {
      setOnlineUsers(0);
    }
  }, [state.roomPresence, roomId]);

  if (onlineUsers === 0) {
    return null;
  }

  return (
    <span className="text-[0.8em] px-2 py-1 text-center text-green-800 dark:text-white bg-green-500/20 dark:bg-green-500/20 border border-green-500/30 dark:border-green-500/30 rounded-full">
      {onlineUsers} online
    </span>
  );
}