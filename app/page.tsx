"use client";

import UnifiedHome from "@/components/HomePage";
import { PresenceConnector } from "@/components/PresenceConnector";
import { useUnifiedStore } from "@/lib/store/unified-roomstore";

export default function Page() {
  const selectedRoomId = useUnifiedStore((s) => s.selectedRoomId);
  const userId = useUnifiedStore((s) => s.userId);


  return (
    <>
      {/* 🔥 Runs presence whenever roomId/userId exist */}
      <PresenceConnector roomId={selectedRoomId} userId={userId} />


      <UnifiedHome />
    </>
  );
}
