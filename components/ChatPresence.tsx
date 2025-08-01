"use client";
import { useUser } from "@/lib/store/user";
import { supabaseBrowser } from "@/lib/supabase/browser";
import React, { useEffect, useState } from "react";
import { useRoomStore } from "@/lib/store/roomstore";

interface PresenceState {
    user_id: string;
    online_at: string;
}

export default function ChatPresence() {
    const user = useUser((state) => state.user);
    const selectedRoom = useRoomStore((state) => state.selectedRoom);
    const supabase = supabaseBrowser();
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!user || !selectedRoom) return;

        const channelName = `room_${selectedRoom.id}_presence`;
        const channel = supabase.channel(channelName, {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        const handleSync = () => {
            const presenceState = channel.presenceState<PresenceState>();
            const userIds = new Set<string>();

            Object.values(presenceState).forEach((stateList) => {
                stateList.forEach((presence) => {
                    if (presence.user_id) {
                        userIds.add(presence.user_id);
                    }
                });
            });

            setOnlineUsers(userIds);
        };

        channel
            .on('presence', { event: 'sync' }, handleSync)
            .on('presence', { event: 'join' }, handleSync)
            .on('presence', { event: 'leave' }, handleSync)
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    try {
                        await channel.track({
                            user_id: user.id,
                            online_at: new Date().toISOString(),
                            room_id: selectedRoom.id
                        });

                        // Ensure the user is marked active in the room
                        await supabase
                            .from("room_members")
                            .update({ active: true })
                            .eq("room_id", selectedRoom.id)
                            .eq("user_id", user.id);
                    } catch (error) {
                        console.error('Error tracking presence or updating active status:', error);
                    }
                }
            });


        return () => {
            channel.untrack();
            channel.unsubscribe();
        };
    }, [user, supabase, selectedRoom]);

    if (!user || !selectedRoom) {
        return <div className="h-3 w-1" />;
    }

    return (
        <div className="flex items-center gap-1 sm:text-[1vw] md:text-[3vw]">
            <div className="h-[.8em] w-[.8em] lg:h-[1em] lg:w-[1em] bg-green-500 rounded-full animate-pulse" />
            <h1 className="text-[1em] sm:text-[1em] md:text-[1em] lg:text-[.3em] text-gray-400">
                {onlineUsers.size} {onlineUsers.size === 1 ? 'online' : 'online'}
            </h1>
        </div>
    );
}