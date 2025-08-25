// hooks/useRoomPresence.ts
import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useUser } from "@/lib/store/user";

interface PresenceState {
    user_id: string;
    online_at: string;
}

/**
 * A hook to track online users for a list of rooms using Supabase Presence.
 * @param roomIds An array of room IDs to track.
 * @returns A map of online user counts for each room.
 */
export const useRoomPresence = (roomIds: string[]) => {
    const user = useUser((state) => state.user);
    const supabase = supabaseBrowser();
    const [onlineCounts, setOnlineCounts] = useState<Map<string, number>>(new Map());

    useEffect(() => {
        if (!user || roomIds.length === 0) {
            setOnlineCounts(new Map());
            return;
        }

        const channels = roomIds.map(roomId => {
            const channelName = `room_${roomId}_presence`;
            return supabase.channel(channelName, {
                config: { presence: { key: user.id } }
            });
        });

        // Set up event listeners for all channels
        channels.forEach(channel => {
            const handlePresence = () => {
                const presenceState = channel.presenceState<PresenceState>();
                const userIds = new Set<string>();
                Object.values(presenceState).forEach(stateList => {
                    stateList.forEach(presence => {
                        if (presence.user_id) {
                            userIds.add(presence.user_id);
                        }
                    });
                });
                
                // Update the count for this specific room
                setOnlineCounts(prev => new Map(prev).set(channel.topic.split('_')[1], userIds.size));
            };

            channel
                .on('presence', { event: 'sync' }, handlePresence)
                .on('presence', { event: 'join' }, handlePresence)
                .on('presence', { event: 'leave' }, handlePresence)
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await channel.track({
                            user_id: user.id,
                            online_at: new Date().toISOString(),
                        });
                    }
                });
        });

        // Cleanup function to unsubscribe from all channels
        return () => {
            channels.forEach(channel => {
                channel.untrack();
                channel.unsubscribe();
            });
        };

    }, [user, supabase, roomIds]);

    return onlineCounts;
};