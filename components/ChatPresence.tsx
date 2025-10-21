"use client";

import { useRoomContext } from "@/lib/store/RoomContext";
import { useActiveUsers } from "@/hooks/useActiveUsers"; // Assuming the path to the hook

export default function ChatPresence() {
  const { state } = useRoomContext();
  const { selectedRoom } = state;

  const onlineUsers = useActiveUsers(selectedRoom?.id ?? null);

  if (!selectedRoom) {
    return <div className="h-3 w-1" />;
  }

  return (
    <div className="flex items-center gap-1 sm:text-[1vw] md:text-[3vw]">
      <div
        className={`h-[1.6vw] w-[1.6vw] lg:h-[.6vw] lg:w-[.6vw] rounded-full 
        ${onlineUsers > 0 ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
      />
      <h1 className="text-[2vw] lg:text-[.3em] text-gray-400">
        {onlineUsers} {onlineUsers === 1 ? "online" : "online"}
      </h1>
    </div>
  );
}