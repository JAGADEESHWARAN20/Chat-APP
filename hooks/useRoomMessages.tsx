"use client";
import { useRoomStore } from '@/lib/store/RoomContext';
import { useMemo } from 'react';

export function useRoomMessages(roomId?: string) {
  const messages = useRoomStore((state) => state.messages);
  const selectedRoomId = useRoomStore((state) => state.selectedRoomId);

  const roomMessages = useMemo(() => {
    const targetRoomId = roomId || selectedRoomId;
    if (!targetRoomId) return [];

    return messages.filter((msg) => msg.room_id === targetRoomId);
  }, [messages, roomId, selectedRoomId]);

  return roomMessages;
}
