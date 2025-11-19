"use client";

import { useUnifiedRoomStore, useRoomPresence } from "@/lib/store/roomstore";
import { Users } from "lucide-react";
import { useEffect, useState } from "react";

interface RoomActiveUsersProps {
  roomId: string;
  showZero?: boolean;
  compact?: boolean;
}

export function RoomActiveUsers({ 
  roomId, 
  showZero = false, 
  compact = false 
}: RoomActiveUsersProps) {
  // ✅ FIXED: Use proper selector - it's 'rooms' not 'availableRooms'
  const rooms = useUnifiedRoomStore((state) => state.rooms);
  
  // ✅ FIXED: useRoomPresence returns the entire presence object, not a hook that takes parameters
  const roomPresence = useRoomPresence();
  
  const [onlineUsers, setOnlineUsers] = useState(0);
  
  // Get member count from room data
  const room = rooms.find(r => r.id === roomId);
  const memberCount = room?.memberCount ?? 0;

  // ✅ FIXED: Extract online count from room presence
  useEffect(() => {
    if (roomId && roomPresence[roomId]) {
      setOnlineUsers(roomPresence[roomId].onlineUsers || 0);
    } else {
      setOnlineUsers(0);
    }
  }, [roomId, roomPresence]);

  // Don't render if no users and showZero is false
  if (onlineUsers === 0 && !showZero) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-1 text-center text-blue-800 dark:text-white bg-blue-500/20 dark:bg-blue-500/20 border border-blue-500/30 dark:border-blue-500/30 rounded-full">
          {memberCount} members
        </span>
        <span className="text-xs px-2 py-1 text-center text-green-800 dark:text-white bg-green-500/20 dark:bg-green-500/20 border border-green-500/30 dark:border-green-500/30 rounded-full">
          {onlineUsers} online
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
      </div>
      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="font-medium">{onlineUsers} online</span>
      </div>
    </div>
  );
}