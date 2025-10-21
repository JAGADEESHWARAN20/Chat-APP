"use client";

import { useRoomContext } from "@/lib/store/RoomContext";
import { RoomActiveUsers } from "./reusable/RoomActiveUsers";

export default function ChatPresence() {
  const { state } = useRoomContext();
  const { selectedRoom } = state;

  if (!selectedRoom) {
    return <div className="h-3 w-1" />;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <RoomActiveUsers roomId={selectedRoom.id} />
      </div>
    </div>
  );
}