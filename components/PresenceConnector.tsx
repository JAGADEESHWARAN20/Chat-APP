"use client";

import { useRoomPresenceSync } from "@/hooks/useRoomPresence";

export function PresenceConnector({ roomId, userId }: { roomId: string | null; userId: string | null }) {
  useRoomPresenceSync(roomId, userId);
  return null;
}
