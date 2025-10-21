// components/RoomActiveUsers.tsx

// components/RoomActiveUsers.tsx
"use client";

import { useActiveUsers } from "@/hooks/useActiveUsers";

export function RoomActiveUsers({ roomId }: { roomId: string }) {
  const activeUsers = useActiveUsers(roomId);
  
  return (
    <p className="text-[0.8em] px-2 py-1 text-center text-green-800 dark:text-white bg-green-500/20 dark:bg-green-500/20 border border-green-500/30 dark:border-green-500/30 rounded-full">
      {activeUsers} active
    </p>
  );
}