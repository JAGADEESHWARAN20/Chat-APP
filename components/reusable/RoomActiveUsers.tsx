"use client";

import React from "react";
import { useUnifiedStore, useRoomPresence } from "@/lib/store/unified-roomstore";
import { Users } from "lucide-react";
import type { RoomData } from "@/lib/store/unified-roomstore";

interface RoomActiveUsersProps {
  roomId: string;
  showZero?: boolean;
  compact?: boolean;
}

export function RoomActiveUsers({
  roomId,
  showZero = false,
  compact = false,
}: RoomActiveUsersProps) {
  const rooms = useUnifiedStore((state) => state.rooms as RoomData[]);
  const presence = useRoomPresence();

  const room = rooms.find((r: RoomData) => r.id === roomId);

  const memberCount = room?.member_count ?? 0;
  const onlineUsers = presence[roomId]?.onlineUsers ?? 0;

  if (onlineUsers === 0 && !showZero) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-1 text-center bg-green-500/20 border border-green-500/30 rounded-full text-green-800 dark:text-white">
          {onlineUsers} online
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </span>
      </div>

      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="font-medium">{onlineUsers} online</span>
      </div>
    </div>
  );
}
