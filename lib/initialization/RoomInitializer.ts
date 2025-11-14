"use client";

import { useEffect } from "react";
import { useRoomStore } from "@/lib/store/room.store";
import { useUser } from "@/lib/store/user";

export default function RoomInitializer() {
  const { user } = useUser();
  const setUserId = useRoomStore((s) => s.setUserId);
  const fetchRooms = useRoomStore((s) => s.fetchRooms);

  useEffect(() => {
    if (!user?.id) return;

    setUserId(user.id);
    fetchRooms();
  }, [user?.id]);

  return null;
}
