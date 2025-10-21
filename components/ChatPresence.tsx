// components/ChatPresence.tsx
"use client";

import { useRoomContext } from "@/lib/store/RoomContext";

export default function ChatPresence() {
  const { state } = useRoomContext();
  const { selectedRoom } = state;

  if (!selectedRoom) {
    return <div className="h-3 w-1" />;
  }

  const activeUsers = selectedRoom.memberCount ?? 0;

  return (
    <div className="flex items-center gap-1 sm:text-[1vw] md:text-[3vw]">
      <div
        className={`h-[1.6vw] w-[1.6vw] lg:h-[.6vw] lg:w-[.6vw] rounded-full 
        ${activeUsers > 0 ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
      />
      <h1 className="text-[2vw] lg:text-[.3em] text-gray-400">
        {activeUsers} {activeUsers === 1 ? "online" : "online"}
      </h1>
    </div>
  );
}
