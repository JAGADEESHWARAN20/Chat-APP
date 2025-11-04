"use client";

import { useEffect, useRef } from "react";
import { useRoomStore } from "@/lib/store/RoomContext";

export default function RoomInitializer() {
  const initializedRef = useRef(false);

  const user = useRoomStore((state) => state.user);
  const fetchRooms = useRoomStore((state) => state.fetchRooms);

  useEffect(() => {
    if (!user || initializedRef.current) return;

    initializedRef.current = true; // ✅ prevents duplicate calls
    console.log("🏁 RoomInitializer: User detected, fetching rooms...");
    fetchRooms();
  }, [user, fetchRooms]); // ✅ `initializeRooms` removed

  return null;
}
