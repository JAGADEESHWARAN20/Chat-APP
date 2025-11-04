"use client";

import { useEffect } from "react";
import { useRoomStore } from "@/lib/store/RoomContext";

export default function RoomInitializer() {
  const user = useRoomStore((state) => state.user);
  const fetchRooms = useRoomStore((state) => state.fetchRooms);

  useEffect(() => {
    if (!user?.id) return;
    
    console.log("🏁 RoomInitializer: User detected, fetching rooms");
    fetchRooms();
  }, [user?.id, fetchRooms]);

  return null;
}
