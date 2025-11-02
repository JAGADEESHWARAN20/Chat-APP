"use client";

import { useRoomContext } from "@/lib/store/RoomContext";
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
  const { getRoomPresence } = useRoomContext();
  const [onlineUsers, setOnlineUsers] = useState(0);

  // ✅ Update when presence changes
  useEffect(() => {
    const updatePresence = () => {
      const { onlineUsers: count } = getRoomPresence(roomId);
      console.log(`[RoomActiveUsers] Room ${roomId}: ${count} online`);
      setOnlineUsers(count);
    };

    updatePresence();
    
    // Poll every 2 seconds to catch updates
    const interval = setInterval(updatePresence, 2000);
    
    return () => clearInterval(interval);
  }, [roomId, getRoomPresence]);

  // Don't render if no users and showZero is false
  if (onlineUsers === 0 && !showZero) {
    return null;
  }

  if (compact) {
    return (
      <span className="text-xs px-2 py-1 text-center text-green-800 dark:text-white bg-green-500/20 dark:bg-green-500/20 border border-green-500/30 dark:border-green-500/30 rounded-full">
        {onlineUsers} online
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
      <Users className="h-3 w-3" />
      <span className="font-medium text-green-600 dark:text-green-400">
        {onlineUsers} online
      </span>
    </div>
  );
}