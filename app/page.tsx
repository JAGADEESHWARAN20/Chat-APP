"use client";

import UnifiedHome from "@/components/HomePage";
import { PresenceConnector } from "@/components/PresenceConnector";
import { useUnifiedRoomStore } from "@/lib/store/roomstore";

export default function Page() {
  const selectedRoomId = useUnifiedRoomStore((s) => s.selectedRoomId);
  const currentUser = useUnifiedRoomStore((s) => s.user);

  return (
    <>
      {/* 🔥 Runs presence whenever roomId/userId exist */}
      <PresenceConnector 
        roomId={selectedRoomId ?? null}
        userId={currentUser?.id ?? null}
      />

      <UnifiedHome />
    </>
  );
}
