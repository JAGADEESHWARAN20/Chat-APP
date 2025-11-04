// components/ChatPresence.tsx
"use client";
import { useRoomContext } from "@/lib/store/RoomContext";
import { RoomActiveUsers } from "./reusable/RoomActiveUsers";

export default function ChatPresence() {
  const { selectedRoom } = useRoomContext();
  if (!selectedRoom) {
    return null;
  }
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-1">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <RoomActiveUsers roomId={selectedRoom.id} showZero compact />
      </div>
    </div>
  );
}