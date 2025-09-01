"use client";

import React from "react";
import { useUser } from "@/lib/store/user";
import { useRoomContext } from "@/lib/store/RoomContext";
import { useActiveUsers } from "@/hooks/useActiveUsers";

export default function ChatPresence() {
  const user = useUser((state) => state.user);
  const { state } = useRoomContext();
  const { selectedRoom } = state;

  // Get active users from DB for this room
  const activeUsers = useActiveUsers(selectedRoom?.id ?? null);

  if (!user || !selectedRoom) {
    return <div className="h-3 w-1" />;
  }

  return (
    <div className="flex items-center gap-1 sm:text-[1vw] md:text-[3vw]">
      <div className="h-[1.6vw] w-[1.6vw] lg:h-[.6vw] lg:w-[.6vw] bg-green-500 rounded-full animate-pulse" />
      <h1 className="text-[2vw] lg:text-[.3em] text-gray-400">
        {activeUsers} {activeUsers === 1 ? "online" : "online"}
      </h1>
    </div>
  );
}
