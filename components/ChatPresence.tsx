"use client";

import React from "react";
import { useUser } from "@/lib/store/user";
import { useRoomContext } from "@/lib/store/RoomContext";
import { useRoomPresence } from "@/hooks/useRoomPresence";

export default function ChatPresence() {
  const user = useUser((state) => state.user);
  const { state } = useRoomContext();
  const { selectedRoom } = state;

  // Use the hook for the selected room
  const onlineCounts = useRoomPresence(selectedRoom ? [selectedRoom.id] : []);
  const onlineCount = selectedRoom ? onlineCounts.get(selectedRoom.id) ?? 0 : 0;

  if (!user || !selectedRoom) {
    return <div className="h-3 w-1" />;
  }

  return (
    <div className="flex items-center gap-1 sm:text-[1vw] md:text-[3vw]">
      <div className="h-[1.6vw] w-[1.6vw] lg:h-[.6vw] lg:w-[.6vw] bg-green-500 rounded-full animate-pulse" />
      <h1 className="text-[2vw] lg:text-[.3em] text-gray-400">
        {onlineCount} {onlineCount === 1 ? "online" : "online"}
      </h1>
    </div>
  );
}
