"use client";
import { useRoomStore } from '@/lib/store/RoomContext';
import { useMemo } from 'react';

export function useRoomMessages(roomId?: string) {
  const messages = useRoomStore((state) => state.messages);
  const selectedRoom = useRoomStore((state) => state.selectedRoom);
  
  const roomMessages = useMemo(() => {
    if (!roomId && !selectedRoom) return [];
    
    const targetRoomId = roomId || selectedRoom?.id;
    return messages.filter((msg: any) => msg.room_id === targetRoomId);
  }, [messages, roomId, selectedRoom]);

  return roomMessages;
}