// hooks/usePresence.ts
"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/store/user";
import { toast } from "@/components/ui/sonner"
import type { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js";
import { useUnifiedRoomStore } from "@/lib/store/roomstore"; // ✅ Use unified store

// Enhanced Type Definitions
interface PresenceData {
  user_id: string;
  online_at: string;
  room_id: string;
  display_name?: string;
  username?: string;
  last_seen?: string;
}

interface UsePresenceOptions {
  roomIds: string[];
  excludeSelf?: boolean;
  offlineTimeout?: number;
}

interface UsePresenceReturn {
  onlineCounts: Map<string, number>;
  onlineUsers: Map<string, PresenceData[]>;
  isLoading: boolean;
  error: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function usePresence({
  roomIds,
  excludeSelf = true,
  offlineTimeout = 15000,
}: UsePresenceOptions): UsePresenceReturn {
  const { user } = useUser();
  const [onlineCounts, setOnlineCounts] = useState<Map<string, number>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Map<string, PresenceData[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for stable references
  const supabase = useRef(getSupabaseBrowserClient());
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const presenceDataRef = useRef<Map<string, Map<string, PresenceData>>>(new Map());
  const isSubscribedRef = useRef<boolean>(false);

  // ✅ Get the setRoomPresence method from the store
  const setRoomPresence = useUnifiedRoomStore((state) => state.setRoomPresence);

  // ✅ FIX 1: Memoize roomIds dependency to avoid complex expression
  const roomIdsKey = useMemo(() => roomIds.join(','), [roomIds]);

  // Validate room IDs
  const validRoomIds = useCallback((ids: string[]): string[] => {
    return ids.filter(id => id && UUID_REGEX.test(id));
  }, []);

  // Type-safe presence state extraction
  const extractPresenceData = useCallback((state: RealtimePresenceState): PresenceData[] => {
    const presenceData: PresenceData[] = [];
    
    try {
      Object.values(state).forEach((presenceArray) => {
        if (Array.isArray(presenceArray)) {
          presenceArray.forEach((presence: any) => {
            if (presence && typeof presence === 'object' && presence.user_id) {
              presenceData.push({
                user_id: String(presence.user_id),
                online_at: presence.online_at || new Date().toISOString(),
                room_id: presence.room_id || '',
                display_name: presence.display_name,
                username: presence.username,
                last_seen: presence.last_seen,
              });
            }
          });
        }
      });
    } catch (err) {
      console.error('Error extracting presence data:', err);
    }
    
    return presenceData;
  }, []);

  // Update presence counts for a specific room
  const updateRoomPresence = useCallback((roomId: string) => {
    const channel = channelsRef.current.get(roomId);
    if (!channel) return;

    try {
      const state = channel.presenceState();
      const currentPresence = presenceDataRef.current.get(roomId) || new Map();
      const now = Date.now();

      // Extract presence data from channel state
      const presenceData = extractPresenceData(state);

      // Update presence data
      presenceData.forEach((presence) => {
        if (presence.user_id) {
          currentPresence.set(presence.user_id, {
            ...presence,
            online_at: presence.online_at,
            last_seen: new Date().toISOString(),
          });
        }
      });

      // Clean up stale entries
      currentPresence.forEach((data, userId) => {
        const lastSeen = new Date(data.online_at).getTime();
        if (now - lastSeen > offlineTimeout) {
          currentPresence.delete(userId);
        }
      });

      presenceDataRef.current.set(roomId, currentPresence);

      // Calculate counts
      const userIds = Array.from(currentPresence.keys());
      const count = excludeSelf && user?.id
        ? userIds.filter(id => id !== user.id).length
        : userIds.length;

      const usersData = Array.from(currentPresence.values());

      // Update state
      setOnlineCounts(prev => new Map(prev).set(roomId, count));
      setOnlineUsers(prev => new Map(prev).set(roomId, usersData));

      // ✅ FIX: Push presence info to Zustand store for UI
      setRoomPresence(roomId, {
        onlineUsers: count,
        userIds: usersData.map(u => u.user_id),
        lastUpdated: new Date().toISOString(),
      });

    } catch (error) {
      console.error(`Error updating presence for room ${roomId}:`, error);
      setError(`Failed to update presence for room ${roomId}`);
    }
  }, [user?.id, excludeSelf, offlineTimeout, extractPresenceData, setRoomPresence]);

  // Clean up stale presence data
  const cleanupStalePresence = useCallback((roomId: string) => {
    const timeout = setTimeout(() => {
      updateRoomPresence(roomId);
      timeoutsRef.current.delete(roomId);
    }, offlineTimeout / 2);

    // Clear existing timeout
    const existingTimeout = timeoutsRef.current.get(roomId);
    if (existingTimeout) clearTimeout(existingTimeout);
    
    timeoutsRef.current.set(roomId, timeout);
  }, [updateRoomPresence, offlineTimeout]);

  // Handle presence events
  const handlePresenceEvent = useCallback((roomId: string) => {
    updateRoomPresence(roomId);
    cleanupStalePresence(roomId);
  }, [updateRoomPresence, cleanupStalePresence]);

  // ✅ FIX 2: Add missing user dependency to subscribeToRoom
  const subscribeToRoom = useCallback(async (roomId: string) => {
    if (channelsRef.current.has(roomId) || !user?.id) {
      return;
    }

    try {
      const channel = supabase.current.channel(`room:${roomId}`, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      // Set up presence event handlers
      channel
        .on('presence', { event: 'sync' }, () => {
          handlePresenceEvent(roomId);
        })
        .on('presence', { event: 'join' }, () => {
          handlePresenceEvent(roomId);
        })
        .on('presence', { event: 'leave' }, () => {
          handlePresenceEvent(roomId);
        })
        .on('system', { event: 'disconnect' }, () => {
          setError(`Disconnected from room ${roomId}`);
        })
        .on('system', { event: 'reconnect' }, () => {
          setError(null);
        });

      // Subscribe to the channel
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            const presencePayload: PresenceData = {
              user_id: user.id,
              room_id: roomId,
              online_at: new Date().toISOString(),
            };

            await channel.track(presencePayload);
            
            // Initial presence update
            setTimeout(() => handlePresenceEvent(roomId), 100);
            
          } catch (trackError) {
            console.error(`Failed to track presence in room ${roomId}:`, trackError);
            setError(`Failed to track presence in room ${roomId}`);
            toast.error('Failed to establish presence tracking');
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Channel error for room ${roomId}`);
          setError(`Connection error for room ${roomId}`);
          toast.error('Presence connection error');
        }
      });

      channelsRef.current.set(roomId, channel);

    } catch (error) {
      console.error(`Failed to subscribe to room ${roomId}:`, error);
      setError(`Failed to subscribe to room ${roomId}`);
    }
  }, [user?.id, handlePresenceEvent]); // ✅ Added user?.id dependency

  // Unsubscribe from a room's presence channel
  const unsubscribeFromRoom = useCallback(async (roomId: string) => {
    const channel = channelsRef.current.get(roomId);
    if (!channel) return;

    try {
      await channel.untrack();
      await channel.unsubscribe();
      channelsRef.current.delete(roomId);
      
      // Clear timeouts
      const timeout = timeoutsRef.current.get(roomId);
      if (timeout) clearTimeout(timeout);
      timeoutsRef.current.delete(roomId);
      
      // Clear presence data
      presenceDataRef.current.delete(roomId);
    } catch (error) {
      console.error(`Error unsubscribing from room ${roomId}:`, error);
    }
  }, []);

  // ✅ FIX 3: Main effect with proper dependencies and cleanup
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const validatedRoomIds = validRoomIds(roomIds);
    if (validatedRoomIds.length === 0) {
      setOnlineCounts(new Map());
      setOnlineUsers(new Map());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    isSubscribedRef.current = true;

    // Initialize presence data structure
    validatedRoomIds.forEach(roomId => {
      if (!presenceDataRef.current.has(roomId)) {
        presenceDataRef.current.set(roomId, new Map());
      }
    });

    // Subscribe to all rooms
    const subscribeToRooms = async () => {
      for (const roomId of validatedRoomIds) {
        if (isSubscribedRef.current) {
          await subscribeToRoom(roomId);
        }
      }
      setIsLoading(false);
    };

    subscribeToRooms();

    // ✅ FIX 4: Proper cleanup with captured ref values
    return () => {
      isSubscribedRef.current = false;
      
      // Capture current ref values to avoid ESLint warnings
      const currentTimeouts = timeoutsRef.current;
      const currentChannels = channelsRef.current;
      const currentPresenceData = presenceDataRef.current;

      // Clear all timeouts using captured values
      currentTimeouts.forEach((timeout) => clearTimeout(timeout));
      timeoutsRef.current.clear();

      // Unsubscribe from all channels using captured values
      currentChannels.forEach((channel, roomId) => {
        channel.untrack().catch(() => {});
        channel.unsubscribe();
      });
      channelsRef.current.clear();

      // Clear presence data using captured values
      currentPresenceData.clear();
      presenceDataRef.current.clear();
    };
  }, [user?.id, roomIdsKey, subscribeToRoom, validRoomIds]); // ✅ Use memoized roomIdsKey

  // ✅ FIX 5: Effect to handle room ID changes with proper dependencies
  useEffect(() => {
    const validatedRoomIds = validRoomIds(roomIds);
    const currentRoomIds = new Set(validatedRoomIds);
    const subscribedRoomIds = new Set(channelsRef.current.keys());

    // Unsubscribe from rooms that are no longer in the list
    subscribedRoomIds.forEach(roomId => {
      if (!currentRoomIds.has(roomId)) {
        unsubscribeFromRoom(roomId);
      }
    });
  }, [roomIdsKey, validRoomIds, unsubscribeFromRoom]); // ✅ Use memoized roomIdsKey

  return {
    onlineCounts,
    onlineUsers,
    isLoading,
    error,
  };
}

// Simplified hook for single room usage
export function useRoomPresence(roomId: string | null, options?: Omit<UsePresenceOptions, 'roomIds'>) {
  const roomIds = roomId ? [roomId] : [];
  const presence = usePresence({ roomIds, ...options });

  const onlineCount = roomId ? presence.onlineCounts.get(roomId) || 0 : 0;
  const onlineUsers = roomId ? presence.onlineUsers.get(roomId) || [] : [];

  return {
    ...presence,
    onlineCount,
    onlineUsers,
  };
}