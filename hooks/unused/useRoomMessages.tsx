// // hooks/useRoomMessages.tsx
// "use client";
// import { useMessage } from "@/lib/store/messages";
// import { useSelectedRoom } from "@/lib/store/roomstore"; // ✅ Use the selector
// import { useMemo } from "react";

// export function useRoomMessages(roomId?: string) {
//   const selectedRoom = useSelectedRoom(); // ✅ Use the selector, not the whole store
//   const messages = useMessage((state) => state.messages);

//   const roomMessages = useMemo(() => {
//     const targetRoomId = roomId || selectedRoom?.id;
//     if (!targetRoomId) return [];

//     return messages
//       .filter((msg) => msg.room_id === targetRoomId)
//       .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
//   }, [messages, roomId, selectedRoom?.id]);

//   return roomMessages;
// }