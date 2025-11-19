"use client";

import { useEffect, useRef } from "react";
import { useUnifiedRoomStore } from "@/lib/store/roomstore";

export default function RoomInitializer() {
  const initializedRef = useRef(false);

  const user = useUnifiedRoomStore((state) => state.user);
  const fetchRooms = useUnifiedRoomStore((state) => state.fetchRooms);

  useEffect(() => {
    if (!user || initializedRef.current) return;

    initializedRef.current = true; // ✅ prevents duplicate calls
    console.log("🏁 RoomInitializer: User detected, fetching rooms...");
    fetchRooms();
  }, [user, fetchRooms]); // ✅ `initializeRooms` removed

  return null;
}
