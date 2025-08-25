"use client";
import { useUser } from "@/lib/store/user";
import { supabaseBrowser } from "@/lib/supabase/browser";
import React, { useEffect } from "react";
import { useRoomPresence } from "@/hooks/useRoomPresence";

interface ChatPresenceProps {
  roomId?: string;
}

export default function ChatPresence({ roomId }: ChatPresenceProps) {
  const user = useUser((state) => state.user);
  const supabase = supabaseBrowser();
  const onlineCounts = useRoomPresence(roomId ? [roomId] : []);
  const online = roomId ? onlineCounts.get(roomId) ?? 0 : 0;

  useEffect(() => {
    if (!user?.id || !roomId) return;

    const updateActive = async (active: boolean) => {
      try {
        await supabase
          .from("room_members")
          .update({ active })
          .eq("room_id", roomId)
          .eq("user_id", user.id);
      } catch (error) {
        console.error('Error updating active status:', error);
      }
    };

    updateActive(true);

    return () => {
      updateActive(false);
    };
  }, [user?.id, supabase, roomId]);

  if (!user || !roomId) {
    return <div className="h-3 w-1" />;
  }

    return (
        <div className="flex items-center gap-1 sm:text-[1vw] md:text-[3vw]">
            <div className="h-[1.6vw] w-[1.6vw] lg:h-[.6vw] lg:w-[.6vw] bg-green-500 rounded-full animate-pulse" />
            <h1 className="text-[2vw] lg:text-[.3em] dark:text-gray-400 text-black ">
                {online} {online === 1 ? 'online' : 'online'}
            </h1>
        </div>
    );
}