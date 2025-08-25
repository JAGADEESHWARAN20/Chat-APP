"use client";
import { useUser } from "@/lib/store/user";
import { supabaseBrowser } from "@/lib/supabase/browser";
import React, { useEffect } from "react";
import { useRoomStore } from "@/lib/store/roomstore";
import { useRoomPresence } from "@/hooks/useRoomPresence";

export default function ChatPresence() {
    const user = useUser((state) => state.user);
    const selectedRoom = useRoomStore((state) => state.selectedRoom);
    const supabase = supabaseBrowser();

    const roomId = selectedRoom?.id;
    const onlineCounts = useRoomPresence(roomId ? [roomId] : []);

    const online = onlineCounts.get(roomId ?? "") ?? 0;

    useEffect(() => {
        if (!user?.id || !selectedRoom?.id) return;

        const updateActive = async (active: boolean) => {
            try {
                await supabase
                    .from("room_members")
                    .update({ active })
                    .eq("room_id", selectedRoom.id)
                    .eq("user_id", user.id);
            } catch (error) {
                console.error('Error updating active status:', error);
            }
        };

        updateActive(true);

        return () => {
            updateActive(false);
        };
    }, [user, supabase, selectedRoom?.id]);

    if (!user || !selectedRoom) {
        return <div className="h-3 w-1" />;
    }

    return (
        <div className="flex items-center gap-1 sm:text-[1vw] md:text-[3vw]">
            <div className="h-[1.6vw] w-[1.6vw] lg:h-[.6vw] lg:w-[.6vw] bg-green-500 rounded-full animate-pulse" />
            <h1 className="text-[2vw] lg:text-[.3em] text-gray-400">
                {online} {online === 1 ? 'online' : 'online'}
            </h1>
        </div>
    );
}