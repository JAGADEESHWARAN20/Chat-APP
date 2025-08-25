// components/ChatPresence.tsx
"use client";
import { useUser } from "@/lib/store/user";
import { useRoomStore } from "@/lib/store/roomstore";
import { useRoomPresence } from "@/hooks/useRoomPresence"; // ✅ Import the new hook
import React from "react";

export default function ChatPresence() {
  const user = useUser((state) => state.user);
  const selectedRoom = useRoomStore((state) => state.selectedRoom);
  
  // ✅ Get the online user counts for the selected room using the hook
  const roomOnlineCounts = useRoomPresence(selectedRoom ? [selectedRoom.id] : []);

  // ✅ Get the specific online count for the current room
  const onlineCount = roomOnlineCounts.get(selectedRoom?.id ?? '') ?? 0;

  // No need for a separate useEffect or useState for onlineUsers
  // The hook manages the subscription and state updates internally.

  if (!user || !selectedRoom) {
    return <div className="h-3 w-1" />;
  }

  return (
    <div className="flex items-center gap-1 sm:text-[1vw] md:text-[3vw]">
      <div className="h-[1.6vw] w-[1.6vw] lg:h-[.6vw] lg:w-[.6vw] bg-green-500 rounded-full animate-pulse" />
      <h1 className="text-[2vw] lg:text-[.3em] text-gray-400">
        {onlineCount} {onlineCount === 1 ? 'online' : 'online'}
      </h1>
    </div>
  );
}