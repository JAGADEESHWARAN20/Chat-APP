// components/ChatPresence.tsx
"use client";
import { useUnifiedStore } from "@/lib/store/unified-roomstore";
import { RoomActiveUsers } from "./reusable/RoomActiveUsers";

export default function ChatPresence() {
  const { selectedRoomId } = useUnifiedStore();
  if (!selectedRoomId) {
    return null;
  }
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-1">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <RoomActiveUsers roomId={selectedRoomId} showZero compact />
      </div>
    </div>
  );
}