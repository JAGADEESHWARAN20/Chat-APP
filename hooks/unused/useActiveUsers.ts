// "use client";
// import { useUnifiedRoomStore } from '@/lib/store/roomstore';
// import { useMemo } from 'react';

// export function useActiveUsers(roomId: string | null): number {
//   const roomPresence = useUnifiedRoomStore((state) => state.roomPresence);
//   const rooms = useUnifiedRoomStore((state) => state.rooms); // ✅ Use 'rooms' not 'availableRooms'

//   return useMemo(() => {
//     if (!roomId) return 0;

//     // If real-time presence exists — use it first (most accurate)
//     const livePresence = roomPresence[roomId];
//     if (livePresence) return livePresence.onlineUsers;

//     // Otherwise fallback to stored room data
//     const room = rooms.find((r) => r.id === roomId); // ✅ Use 'rooms' here
//     return room?.online_users ?? 0; // ✅ Use 'online_users' (the actual property name)
//   }, [roomId, roomPresence, rooms]);
// }