"use client";
import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, useMemo } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";
import { useMessage, Imessage } from "./messages";
import type { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js";

// ✅ UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---- Enhanced Types ----
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type DirectChat = Database["public"]["Tables"]["direct_chats"]["Row"];
type PartialProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

// Enhanced Presence Types
interface PresenceData {
  user_id: string;
  online_at: string;
  room_id: string;
  display_name?: string;
  username?: string;
  last_seen?: string;
}

interface PresenceState {
  onlineCounts: Map<string, number>;
  onlineUsers: Map<string, PresenceData[]>;
  isLoading: boolean;
  error: string | null;
}

type CachedProfile = {
  display_name?: string;
  username?: string;
  avatar_url?: string;
};

// Enhanced TypingUser with lastSeen property
type TypingUser = {
  user_id: string;
  is_typing: boolean;
  display_name?: string;
  username?: string;
  lastSeen?: number;
};

export type RoomWithMembershipCount = Room & {
  isMember: boolean;
  participationStatus: string | null;
  memberCount: number;
  latestMessage?: string;
  unreadCount?: number;
  totalUsers?: number;
  onlineUsers?: number;
};

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

// ---- Enhanced State ----
interface RoomState {
  availableRooms: RoomWithMembershipCount[];
  selectedRoom: RoomWithMembershipCount | null;
  selectedDirectChat: DirectChat | null;
  isLoading: boolean;
  isMember: boolean;
  isLeaving: boolean;
  user: SupabaseUser | null;
  typingUsers: TypingUser[];
  typingDisplayText: string;
  unreadNotifications: number;
  presence: PresenceState;
}

// ---- Enhanced Actions ----
type RoomAction =
  | { type: "SET_AVAILABLE_ROOMS"; payload: RoomWithMembershipCount[] }
  | { type: "SET_SELECTED_ROOM"; payload: RoomWithMembershipCount | null }
  | { type: "SET_SELECTED_DIRECT_CHAT"; payload: DirectChat | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_IS_MEMBER"; payload: boolean }
  | { type: "SET_IS_LEAVING"; payload: boolean }
  | { type: "SET_USER"; payload: SupabaseUser | null }
  | { type: "SET_TYPING_USERS"; payload: TypingUser[] }
  | { type: "SET_TYPING_TEXT"; payload: string }
  | { type: "RESET_UNREAD_NOTIFICATIONS"; payload?: number }
  | {
      type: "UPDATE_ROOM_MEMBERSHIP";
      payload: {
        roomId: string;
        isMember: boolean;
        participationStatus: string | null;
      };
    }
  | {
      type: "UPDATE_ROOM_MEMBER_COUNT";
      payload: { roomId: string; memberCount: number };
    }
  | { type: "REMOVE_ROOM"; payload: string }
  | { type: "ADD_ROOM"; payload: RoomWithMembershipCount }
  | {
      type: "UPDATE_ROOM_MESSAGES";
      payload: {
        roomId: string;
        latestMessage?: string;
        unreadCount?: number;
        totalUsers?: number;
        onlineUsers?: number;
      };
    }
  | { type: "SET_PRESENCE_LOADING"; payload: boolean }
  | { type: "SET_PRESENCE_ERROR"; payload: string | null }
  | { type: "UPDATE_ONLINE_COUNTS"; payload: Map<string, number> }
  | { type: "UPDATE_ONLINE_USERS"; payload: Map<string, PresenceData[]> }
  | { type: "UPDATE_ROOM_PRESENCE"; payload: { roomId: string; count: number; users: PresenceData[] } };

const initialState: RoomState = {
  availableRooms: [],
  selectedRoom: null,
  selectedDirectChat: null,
  isLoading: false,
  isMember: false,
  isLeaving: false,
  user: null,
  typingUsers: [],
  typingDisplayText: "",
  unreadNotifications: 0,
  presence: {
    onlineCounts: new Map(),
    onlineUsers: new Map(),
    isLoading: false,
    error: null,
  },
};

function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case "SET_AVAILABLE_ROOMS":
      return { ...state, availableRooms: action.payload };
    case "SET_SELECTED_ROOM":
      return { ...state, selectedRoom: action.payload, selectedDirectChat: null };
    case "SET_SELECTED_DIRECT_CHAT":
      return { ...state, selectedDirectChat: action.payload, selectedRoom: null };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_IS_MEMBER":
      return { ...state, isMember: action.payload };
    case "SET_IS_LEAVING":
      return { ...state, isLeaving: action.payload };
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_TYPING_USERS":
      return { ...state, typingUsers: action.payload };
    case "SET_TYPING_TEXT":
      return { ...state, typingDisplayText: action.payload };
    case "RESET_UNREAD_NOTIFICATIONS":
      return { ...state, unreadNotifications: action.payload ?? 0 };
    case "UPDATE_ROOM_MEMBERSHIP":
      return {
        ...state,
        availableRooms: state.availableRooms.map((room) =>
          room.id === action.payload.roomId
            ? {
                ...room,
                isMember: action.payload.isMember,
                participationStatus: action.payload.participationStatus,
              }
            : room
        ),
        selectedRoom:
          state.selectedRoom?.id === action.payload.roomId
            ? {
                ...state.selectedRoom,
                isMember: action.payload.isMember,
                participationStatus: action.payload.participationStatus,
              }
            : state.selectedRoom ?? null,
      };
    case "UPDATE_ROOM_MEMBER_COUNT":
      return {
        ...state,
        availableRooms: state.availableRooms.map((room) =>
          room.id === action.payload.roomId
            ? { ...room, memberCount: action.payload.memberCount }
            : room
        ),
        selectedRoom:
          state.selectedRoom?.id === action.payload.roomId
            ? { ...state.selectedRoom, memberCount: action.payload.memberCount }
            : state.selectedRoom ?? null,
      };
    case "UPDATE_ROOM_MESSAGES":
      return {
        ...state,
        availableRooms: state.availableRooms.map((room) =>
          room.id === action.payload.roomId
            ? {
                ...room,
                latestMessage: action.payload.latestMessage,
                unreadCount: action.payload.unreadCount,
                totalUsers: action.payload.totalUsers,
                onlineUsers: action.payload.onlineUsers,
              }
            : room
        ),
        selectedRoom:
          state.selectedRoom?.id === action.payload.roomId
            ? {
                ...state.selectedRoom,
                latestMessage: action.payload.latestMessage,
                unreadCount: action.payload.unreadCount,
                totalUsers: action.payload.totalUsers,
                onlineUsers: action.payload.onlineUsers,
              }
            : state.selectedRoom ?? null,
      };
    case "REMOVE_ROOM":
      return {
        ...state,
        availableRooms: state.availableRooms.filter(
          (room) => room.id !== action.payload
        ),
        selectedRoom:
          state.selectedRoom?.id === action.payload ? null : state.selectedRoom ?? null,
      };
    case "ADD_ROOM":
      return {
        ...state,
        availableRooms: [...state.availableRooms, action.payload],
      };
    case "SET_PRESENCE_LOADING":
      return {
        ...state,
        presence: { ...state.presence, isLoading: action.payload }
      };
    case "SET_PRESENCE_ERROR":
      return {
        ...state,
        presence: { ...state.presence, error: action.payload }
      };
    case "UPDATE_ONLINE_COUNTS":
      return {
        ...state,
        presence: { ...state.presence, onlineCounts: action.payload }
      };
    case "UPDATE_ONLINE_USERS":
      return {
        ...state,
        presence: { ...state.presence, onlineUsers: action.payload }
      };
    case "UPDATE_ROOM_PRESENCE":
      const newOnlineCounts = new Map(state.presence.onlineCounts);
      const newOnlineUsers = new Map(state.presence.onlineUsers);
      newOnlineCounts.set(action.payload.roomId, action.payload.count);
      newOnlineUsers.set(action.payload.roomId, action.payload.users);
      
      return {
        ...state,
        presence: {
          ...state.presence,
          onlineCounts: newOnlineCounts,
          onlineUsers: newOnlineUsers,
        }
      };
    default:
      return state;
  }
}

interface RoomContextType {
  state: RoomState;
  fetchAvailableRooms: () => Promise<void>;
  setSelectedRoom: (room: RoomWithMembershipCount | null) => void;
  setSelectedDirectChat: (chat: DirectChat | null) => void;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  switchRoom: (newRoomId: string) => Promise<void>;
  createRoom: (name: string, isPrivate: boolean) => Promise<void>;
  checkRoomMembership: (roomId: string) => Promise<boolean>;
  checkRoomParticipation: (roomId: string) => Promise<string | null>;
  addMessage: (message: Imessage) => void;
  acceptJoinNotification: (roomId: string) => Promise<void>;
  fetchAllUsers: () => Promise<PartialProfile[]>;
  updateTypingUsers: (users: TypingUser[]) => void;
  updateTypingText: (text: string) => void;
  fetchRoomMessages: (roomId: string) => Promise<{ latestMessage?: string; unreadCount?: number }>;
  fetchRoomUsers: (roomId: string) => Promise<{ totalUsers: number; onlineUsers: number }>;
  refreshRoomData: (roomId: string) => Promise<void>;
  messagesForRoom: Imessage[];
  typingDisplay: string;
  handleScrollNotification: (isNearBottom: boolean, newUnreadDelta?: number) => void;
  triggerScrollToBottom: () => void;
  unreadNotifications: number;
  currentUser: SupabaseUser | null;
  currentUserId: string | null;
  supabase: ReturnType<typeof getSupabaseBrowserClient>;
  updateRoomPresence: (roomId: string, count: number, users: PresenceData[]) => void;
  getOnlineCount: (roomId: string) => number;
  getOnlineUsers: (roomId: string) => PresenceData[];
  refreshPresence: (roomIds: string[]) => void;
  
  presence: {
    onlineCounts: Map<string, number>;
    onlineUsers: Map<string, PresenceData[]>;
    isLoading: boolean;
    error: string | null;
  };
  getAllRoomMemberCounts: () => Promise<Map<string, number>>;
  updateTypingUsersWithProfiles: (userIds: string[]) => Promise<void>;
  startTyping: (roomId: string) => Promise<void>;
  stopTyping: (roomId: string) => Promise<void>;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

// ---- Enhanced Provider ----
export function RoomProvider({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SupabaseUser | undefined;
}) {
  const [state, dispatch] = useReducer(roomReducer, initialState);
  const supabase = getSupabaseBrowserClient();
  const profilesCache = useRef<Map<string, CachedProfile>>(new Map());
  const scrollTriggerRef = useRef<(() => void) | null>(null);
  
  // Enhanced: Presence tracking refs
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const presenceDataRef = useRef<Map<string, Map<string, PresenceData>>>(new Map());
  const isSubscribedRef = useRef<boolean>(false);

  // Use message store early
  const { addMessage: addMessageToStore, messages, optimisticIds, optimisticUpdateMessage, optimisticDeleteMessage } = useMessage();

  const addMessage = useCallback((message: Imessage) => {
    if (!messages.some((m) => m.id === message.id)) {
      addMessageToStore(message);
    }
  }, [messages, addMessageToStore]);

  // Enhanced: Presence management functions
  const validateRoomIds = useCallback((ids: string[]): string[] => {
    return ids.filter(id => id && UUID_REGEX.test(id));
  }, []);

  const extractPresenceData = useCallback((presenceState: RealtimePresenceState, currentUserId?: string): PresenceData[] => {
    const presenceData: PresenceData[] = [];
    
    try {
      Object.values(presenceState).forEach((presenceArray: any) => {
        if (Array.isArray(presenceArray)) {
          presenceArray.forEach((presence: any) => {
            // Access presence data directly
            const presencePayload = presence;
            if (presencePayload && typeof presencePayload === 'object' && presencePayload.user_id) {
              // Skip current user if userId provided
              if (currentUserId && presencePayload.user_id === currentUserId) return;
              
              presenceData.push({
                user_id: String(presencePayload.user_id),
                online_at: presencePayload.online_at || new Date().toISOString(),
                room_id: presencePayload.room_id || '',
                display_name: presencePayload.display_name ? String(presencePayload.display_name) : 'Unknown User',
                username: presencePayload.username ? String(presencePayload.username) : '',
                last_seen: presencePayload.last_seen,
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
 
  const updateRoomPresence = useCallback((roomId: string, count: number, users: PresenceData[]) => {
    dispatch({
      type: "UPDATE_ROOM_PRESENCE",
      payload: { roomId, count, users }
    });
  }, []);

  const getOnlineCount = useCallback((roomId: string): number => {
    return state.presence.onlineCounts.get(roomId) || 0;
  }, [state.presence.onlineCounts]);

  const getOnlineUsers = useCallback((roomId: string): PresenceData[] => {
    return state.presence.onlineUsers.get(roomId) || [];
  }, [state.presence.onlineUsers]);

  const updateRoomPresenceFromChannel = useCallback((roomId: string) => {
    const channel = channelsRef.current.get(roomId);
    if (!channel) return;
  
    try {
      const presenceState = channel.presenceState();
      const currentPresence = presenceDataRef.current.get(roomId) || new Map();
      const now = Date.now();
  
      const presenceData = extractPresenceData(presenceState, state.user?.id);

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

      // Clean up stale entries (older than 30 seconds)
      currentPresence.forEach((data, userId) => {
        const lastSeen = new Date(data.online_at).getTime();
        if (now - lastSeen > 30000) { // 30 seconds
          currentPresence.delete(userId);
        }
      });

      presenceDataRef.current.set(roomId, currentPresence);

      // Calculate counts - exclude current user
      const userIds = Array.from(currentPresence.keys());
      const count = userIds.length; // Already filtered current user in extractPresenceData
      const usersData = Array.from(currentPresence.values());

      updateRoomPresence(roomId, count, usersData);

    } catch (error) {
      console.error(`Error updating presence for room ${roomId}:`, error);
      dispatch({ type: "SET_PRESENCE_ERROR", payload: `Failed to update presence for room ${roomId}` });
    }
  }, [state.user?.id, extractPresenceData, updateRoomPresence]);

  const subscribeToRoomPresence = useCallback(async (roomId: string) => {
    if (channelsRef.current.has(roomId) || !state.user?.id) return;
  
    try {
      const channel = supabase.channel(`room:${roomId}`, {
        config: {
          presence: {
            key: state.user.id,
          },
        },
      });
  
      const handlePresenceEvent = () => {
        updateRoomPresenceFromChannel(roomId);
      };
  
      channel
        .on('presence', { event: 'sync' }, handlePresenceEvent)
        .on('presence', { event: 'join' }, handlePresenceEvent)
        .on('presence', { event: 'leave' }, handlePresenceEvent)
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            try {
              // Get user profile for presence data with proper typing
              const { data: userProfile, error } = await supabase
                .from('profiles')
                .select('display_name, username')
                .eq('id', state.user!.id)
                .single();
  
              if (error) {
                console.error('Error fetching user profile for presence:', error);
              }
  
              const presencePayload: PresenceData = {
                user_id: state.user!.id,
                room_id: roomId,
                online_at: new Date().toISOString(),
                display_name: userProfile?.display_name ? String(userProfile.display_name) : undefined,
                username: userProfile?.username ? String(userProfile.username) : undefined,
              };
  
              await channel.track(presencePayload);
              setTimeout(() => updateRoomPresenceFromChannel(roomId), 200);
            } catch (error) {
              console.error(`Failed to track presence in room ${roomId}:`, error);
            }
          }
        });
  
      channelsRef.current.set(roomId, channel);
      presenceDataRef.current.set(roomId, new Map());
  
    } catch (error) {
      console.error(`Failed to subscribe to room ${roomId}:`, error);
    }
  }, [state.user?.id, supabase, updateRoomPresenceFromChannel]);

  const unsubscribeFromRoomPresence = useCallback(async (roomId: string) => {
    const channel = channelsRef.current.get(roomId);
    if (!channel) return;

    try {
      await channel.untrack();
      await channel.unsubscribe();
      channelsRef.current.delete(roomId);
      presenceDataRef.current.delete(roomId);
    } catch (error) {
      console.error(`Error unsubscribing from room ${roomId}:`, error);
    }
  }, []);

  const refreshPresence = useCallback((roomIds: string[]) => {
    const validatedRoomIds = validateRoomIds(roomIds);
    
    // Unsubscribe from rooms no longer in the list
    channelsRef.current.forEach((channel, subscribedRoomId) => {
      if (!validatedRoomIds.includes(subscribedRoomId)) {
        unsubscribeFromRoomPresence(subscribedRoomId);
      }
    });

    // Subscribe to new rooms and refresh existing ones
    validatedRoomIds.forEach(roomId => {
      if (!channelsRef.current.has(roomId)) {
        subscribeToRoomPresence(roomId);
      } else {
        // Refresh presence for already subscribed rooms
        updateRoomPresenceFromChannel(roomId);
      }
    });
  }, [validateRoomIds, subscribeToRoomPresence, unsubscribeFromRoomPresence, updateRoomPresenceFromChannel]);

  // Fix the critical cleanup effect
  useEffect(() => {
    if (!state.user?.id) {
      // Capture current state for cleanup
      const currentChannels = new Map(channelsRef.current);
      currentChannels.forEach((_, roomId) => {
        unsubscribeFromRoomPresence(roomId);
      });
      return;
    }

    const roomIds = state.availableRooms
      .map(room => room?.id)
      .filter((id): id is string => Boolean(id) && typeof id === 'string' && UUID_REGEX.test(id));
    
    refreshPresence(roomIds);

    return () => {
      isSubscribedRef.current = false;
      
      // ✅ CRITICAL: Capture current ref values before cleanup
      const channelsSnapshot = new Map(channelsRef.current);
      const presenceDataSnapshot = new Map(presenceDataRef.current);
      
      // Cleanup using captured values
      channelsSnapshot.forEach((channel, roomId) => {
        channel.untrack().catch(() => {});
        channel.unsubscribe();
        channelsRef.current.delete(roomId);
      });
      
      presenceDataSnapshot.forEach((_, roomId) => {
        presenceDataRef.current.delete(roomId);
      });
    };
  }, [state.user?.id, state.availableRooms, refreshPresence, unsubscribeFromRoomPresence]);

  // Set user
  useEffect(() => {
    dispatch({ type: "SET_USER", payload: user ?? null });
  }, [user]);

  // Clear on no user
  useEffect(() => {
    if (!user) {
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      dispatch({ type: "SET_SELECTED_ROOM", payload: null });
      dispatch({ type: "SET_SELECTED_DIRECT_CHAT", payload: null });
      dispatch({ type: "SET_TYPING_USERS", payload: [] });
      dispatch({ type: "SET_TYPING_TEXT", payload: "" });
      dispatch({ type: "UPDATE_ONLINE_COUNTS", payload: new Map() });
      dispatch({ type: "UPDATE_ONLINE_USERS", payload: new Map() });
    }
  }, [user]);

  // Helper functions for typing
  const updateTypingUsers = useCallback((users: TypingUser[]) => {
    dispatch({ type: "SET_TYPING_USERS", payload: users });
  }, []);

  const updateTypingText = useCallback((text: string) => {
    dispatch({ type: "SET_TYPING_TEXT", payload: text });
  }, []);

  // Enhanced typing profile fetching
  const fetchProfiles = useCallback(async (userIds: string[]) => {
    const validUserIds = userIds.filter(id => id && UUID_REGEX.test(id));
    if (validUserIds.length === 0) return;

    const uncachedIds = validUserIds.filter((id) => !profilesCache.current.has(id));
    if (uncachedIds.length === 0) return;

    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", uncachedIds);

      if (error) {
        console.error("Failed to fetch profiles:", error);
        return;
      }

      // Update cache
      if (profiles) {
        profiles.forEach((profile) => {
          const cachedProfile: CachedProfile = {
            display_name: profile.display_name ? String(profile.display_name) : undefined,
            username: profile.username ? String(profile.username) : undefined,
            avatar_url: profile.avatar_url ? String(profile.avatar_url) : undefined,
          };
          profilesCache.current.set(String(profile.id), cachedProfile);
        });
      }
    } catch (error) {
      console.error("Error in fetchProfiles:", error);
    }
  }, [supabase]);

  const updateTypingUsersWithProfiles = useCallback(
    async (userIds: string[]) => {
      if (!userIds || userIds.length === 0) {
        updateTypingUsers([]);
        return;
      }

      await fetchProfiles(userIds);

      const updatedTypingUsers: TypingUser[] = userIds.map((id: string) => {
        const profile = profilesCache.current.get(id);
        return {
          user_id: id,
          is_typing: true,
          display_name: profile?.display_name,
          username: profile?.username,
        };
      });

      updateTypingUsers(updatedTypingUsers);
    },
    [fetchProfiles, updateTypingUsers]
  );

  // Cleanup function to clear cache periodically
  useEffect(() => {
    const interval = setInterval(() => {
      // Clear cache if it grows too large to prevent memory leaks
      if (profilesCache.current.size > 100) {
        profilesCache.current.clear();
      }
    }, 300000); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  // Enhanced typing subscription
  useEffect(() => {
    if (!state.selectedRoom?.id || !state.user?.id) {
      updateTypingUsers([]);
      return;
    }

    const roomId = state.selectedRoom.id;
    console.log(`⌨️ Setting up typing subscription for room: ${roomId}`);

    const channel = supabase.channel(`typing:${roomId}`);

    // Handle incoming typing events
    channel.on(
      'broadcast',
      { event: 'typing' },
      ({ payload }) => {
        console.log('⌨️ Received typing event:', payload);
        if (payload.user_id === state.user!.id) return;

        const now = Date.now();
        const updatedUsers = [...state.typingUsers];
        const existingIndex = updatedUsers.findIndex(u => u.user_id === payload.user_id);

        if (payload.is_typing) {
          // User started typing
          if (existingIndex >= 0) {
            updatedUsers[existingIndex] = { 
              ...updatedUsers[existingIndex], 
              is_typing: true,
              lastSeen: now 
            };
          } else {
            // Fetch user profile for new typing user
            fetchProfiles([payload.user_id]).then(() => {
              const profile = profilesCache.current.get(payload.user_id);
              const newUser: TypingUser = {
                user_id: payload.user_id,
                is_typing: true,
                display_name: profile?.display_name,
                username: profile?.username,
                lastSeen: now
              };
              updatedUsers.push(newUser);
              updateTypingUsers(updatedUsers);
            });
          }
        } else {
          // User stopped typing
          if (existingIndex >= 0) {
            updatedUsers.splice(existingIndex, 1);
          }
        }

        updateTypingUsers(updatedUsers);
      }
    ).subscribe();

    // Cleanup stale typing users every second
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 3000; // 3 seconds
      
      const activeUsers = state.typingUsers.filter(user => {
        const userWithLastSeen = user as TypingUser;
        return userWithLastSeen.lastSeen && (now - userWithLastSeen.lastSeen < staleThreshold);
      });
      
      if (activeUsers.length !== state.typingUsers.length) {
        updateTypingUsers(activeUsers);
      }
    }, 1000);

    return () => {
      console.log(`⌨️ Cleaning up typing subscription for room: ${roomId}`);
      supabase.removeChannel(channel);
      clearInterval(cleanupInterval);
      updateTypingUsers([]);
    };
  }, [state.selectedRoom?.id, state.user?.id, state.typingUsers, supabase, updateTypingUsers, fetchProfiles]);

  // Compute typing text from users
  useEffect(() => {
    const activeTypingUsers = state.typingUsers.filter(user => user.is_typing);
    
    if (activeTypingUsers.length === 0) {
      updateTypingText("");
      return;
    }

    const typingNames = activeTypingUsers
      .slice(0, 3) // Limit to 3 names
      .map(user => user.display_name || user.username || "Someone")
      .filter(Boolean);

    let text = "";
    if (typingNames.length === 1) {
      text = `${typingNames[0]} is typing...`;
    } else if (typingNames.length === 2) {
      text = `${typingNames[0]} and ${typingNames[1]} are typing...`;
    } else if (typingNames.length === 3) {
      text = `${typingNames[0]}, ${typingNames[1]}, and ${typingNames[2]} are typing...`;
    } else {
      text = "Several people are typing...";
    }

    updateTypingText(text);
  }, [state.typingUsers, updateTypingText]);

  // Memoized messagesForRoom with proper typing
  const messagesForRoom = useMemo(() => {
    if (!messages || !Array.isArray(messages) || !state.selectedRoom?.id) return [];
    return messages
      .filter((msg): msg is Imessage => msg && msg.room_id === state.selectedRoom!.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages, state.selectedRoom]);

  // Centralized realtime message handler
  const handleRoomMessages = useCallback(
    (payload: any) => {
      try {
        const messagePayload = payload.new as MessageRow | null;
        if (!messagePayload || !state.selectedRoom || messagePayload.room_id !== state.selectedRoom.id) return;

        if (payload.eventType === "INSERT") {
          if (optimisticIds.includes(messagePayload.id)) return;

          supabase
            .from("profiles")
            .select("*")
            .eq("id", messagePayload.sender_id)
            .single()
            .then(({ data: profile, error }) => {
              if (error || !profile) return;

              if (messages.some((m) => m.id === messagePayload.id)) return;

              const typedProfile = profile as ProfileRow;
              const newMessage: Imessage = {
                id: messagePayload.id,
                created_at: messagePayload.created_at,
                is_edited: messagePayload.is_edited,
                sender_id: messagePayload.sender_id,
                room_id: messagePayload.room_id,
                direct_chat_id: messagePayload.direct_chat_id,
                dm_thread_id: messagePayload.dm_thread_id,
                status: messagePayload.status,
                text: messagePayload.text,
                profiles: {
                  id: typedProfile.id,
                  avatar_url: typedProfile.avatar_url ?? null,
                  display_name: typedProfile.display_name ?? null,
                  username: typedProfile.username ?? null,
                  created_at: typedProfile.created_at ?? null,
                  bio: typedProfile.bio ?? null,
                  updated_at: typedProfile.updated_at ?? null,
                },
              };

              addMessage(newMessage);
            });
        } else if (payload.eventType === "UPDATE") {
          const oldMessage = messages.find((m) => m.id === messagePayload.id);
          if (oldMessage) {
            optimisticUpdateMessage(messagePayload.id, {
              ...oldMessage,
              text: messagePayload.text,
              is_edited: messagePayload.is_edited,
            });
          }
        } else if (payload.eventType === "DELETE") {
          optimisticDeleteMessage((payload.old as MessageRow).id);
        }
      } catch (err) {
        console.error("[RoomContext] Realtime message error:", err);
        toast.error("Error processing message update");
      }
    },
    [state.selectedRoom, optimisticIds, supabase, messages, addMessage, optimisticUpdateMessage, optimisticDeleteMessage]
  );

  // Realtime subscription for messages
  useEffect(() => {
    if (!state.selectedRoom?.id) return;

    const messageChannel = supabase.channel(`room_messages_${state.selectedRoom.id}`);

    messageChannel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${state.selectedRoom.id}`,
        },
        handleRoomMessages
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [state.selectedRoom?.id, supabase, handleRoomMessages]);

  // Utility function to check user room membership with proper typing and error handling
 // FIXED: Add proper type assertions
const checkUserRoomMembership = useCallback(async (userId: string, roomId: string) => {
  try {
    console.log(`🔍 Checking membership for user ${userId} in room ${roomId}`);
    
    const [membersResult, participantsResult] = await Promise.all([
      supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("room_participants")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .maybeSingle()
    ]);
  
    // Handle errors gracefully - not finding a record is not an error
    const memberStatus = membersResult.data?.status as string | null;
    const participantStatus = participantsResult.data?.status as string | null;
  
    console.log(`📊 Membership results for room ${roomId}:`, { 
      memberStatus, 
      participantStatus,
      hasMemberData: !!membersResult.data,
      hasParticipantData: !!participantsResult.data
    });
  
    const isAccepted = memberStatus === 'accepted' || participantStatus === 'accepted';
    const isPending = memberStatus === 'pending' || participantStatus === 'pending';
    
    return {
      isMember: isAccepted,
      participationStatus: memberStatus || participantStatus || null,
      isPending,
      isAccepted
    };
  } catch (error) {
    console.error(`❌ Error checking membership for user ${userId} in room ${roomId}:`, error);
    return {
      isMember: false,
      participationStatus: null,
      isPending: false,
      isAccepted: false
    };
  }
}, [supabase]);

  // getRoomMemberCount with proper typing
  const getRoomMemberCount = useCallback(async (roomId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('room_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('status', 'accepted');
  
      if (error) {
        console.error(`Error counting members for room ${roomId}:`, error);
        return 0;
      }
  
      return count || 0;
    } catch (error) {
      console.error(`Error counting members for room ${roomId}:`, error);
      return 0;
    }
  }, [supabase]);
  
  // getAllRoomMemberCounts with proper typing
  const getAllRoomMemberCounts = useCallback(async (): Promise<Map<string, number>> => {
    try {
      console.log("🔍 Fetching all room member counts...");
      
      // Method 1: Direct query - count members per room
      const { data: allRooms, error: roomsError } = await supabase
        .from('rooms')
        .select('id');
  
      if (roomsError) {
        console.error("❌ Error fetching rooms:", roomsError);
        return new Map();
      }
  
      if (!allRooms || allRooms.length === 0) {
        console.log("ℹ️ No rooms found for counting members");
        return new Map();
      }
  
      const countsMap = new Map<string, number>();
      
      // Count members for each room
      for (const room of allRooms) {
        try {
          const roomId = typeof room.id === 'string' ? room.id : String(room.id);
          if (!roomId || !UUID_REGEX.test(roomId)) {
            console.error(`❌ Invalid room ID: ${roomId}`);
            continue;
          }

          const { count, error } = await supabase
            .from('room_members')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', roomId)
            .eq('status', 'accepted');
  
          if (error) {
            console.error(`❌ Error counting members for room ${roomId}:`, error);
            countsMap.set(roomId, 0);
          } else {
            countsMap.set(roomId, count || 0);
          }
        } catch (error) {
          const roomId = typeof room.id === 'string' ? room.id : String(room.id);
          console.error(`❌ Error processing room ${roomId}:`, error);
          if (roomId && UUID_REGEX.test(roomId)) {
            countsMap.set(roomId, 0);
          }
        }
      }
  
      console.log("✅ Room member counts:", Object.fromEntries(countsMap));
      return countsMap;
      
    } catch (error) {
      console.error("💥 Error in getAllRoomMemberCounts:", error);
      return new Map();
    }
  }, [supabase]);

  // Function to fetch room messages with proper typing and error handling
  const fetchRoomMessages = useCallback(async (roomId: string): Promise<{ latestMessage?: string; unreadCount?: number }> => {
    try {
      // Get latest message
      const { data: latestMessages, error: latestError } = await supabase
        .from("messages")
        .select("text, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (latestError) {
        console.error(`Error fetching latest message for room ${roomId}:`, latestError);
      }
      
      const latestMessageData = latestMessages?.[0];
  
      // Get unread count (messages from last 24 hours)
      const { count: unreadCountRaw, error: unreadError } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("room_id", roomId)
        .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
      if (unreadError) {
        console.error(`Error fetching unread count for room ${roomId}:`, unreadError);
      }
  
      const latestMessageText = typeof latestMessageData?.text === 'string' 
        ? latestMessageData.text 
        : undefined;
      
      return {
        latestMessage: latestMessageText,
        unreadCount: unreadCountRaw || 0,
      };
    } catch (error) {
      console.error(`Error fetching messages for room ${roomId}:`, error);
      return {
        latestMessage: undefined,
        unreadCount: 0,
      };
    }
  }, [supabase]);

  // fetchRoomUsers with proper typing
  const fetchRoomUsers = useCallback(async (roomId: string): Promise<{ totalUsers: number; onlineUsers: number }> => {
    try {
      const { count, error } = await supabase
        .from("room_members")
        .select("user_id", { count: 'exact', head: true })
        .eq("room_id", roomId)
        .eq("status", "accepted");
  
      if (error) {
        console.error(`Error fetching users for room ${roomId}:`, error);
        return { totalUsers: 0, onlineUsers: 0 };
      }
  
      const totalUsers = count || 0;
      const onlineUsers = getOnlineCount(roomId); // Use presence data for online count

      return { totalUsers, onlineUsers };
    } catch (error) {
      console.error(`Error fetching users for room ${roomId}:`, error);
      return { totalUsers: 0, onlineUsers: 0 };
    }
  }, [supabase, getOnlineCount]);

  // Function to refresh individual room data
  const refreshRoomData = useCallback(async (roomId: string) => {
    try {
      const [messagesData, usersData, memberCount] = await Promise.all([
        fetchRoomMessages(roomId),
        fetchRoomUsers(roomId),
        getRoomMemberCount(roomId)
      ]);

      dispatch({
        type: "UPDATE_ROOM_MESSAGES",
        payload: {
          roomId,
          latestMessage: messagesData.latestMessage,
          unreadCount: messagesData.unreadCount,
          totalUsers: usersData.totalUsers,
          onlineUsers: usersData.onlineUsers,
        },
      });

      dispatch({
        type: "UPDATE_ROOM_MEMBER_COUNT",
        payload: { roomId, memberCount },
      });
    } catch (error) {
      console.error(`Error refreshing data for room ${roomId}:`, error);
      toast.error("Failed to refresh room data");
    }
  }, [fetchRoomMessages, fetchRoomUsers, getRoomMemberCount]);

  // Typing helper functions
  const startTyping = useCallback(async (roomId: string) => {
    if (!state.user?.id) return;

    try {
      await supabase
        .from('typing_status')
        .upsert({
          user_id: state.user.id,
          room_id: roomId,
          is_typing: true,
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error starting typing:', error);
    }
  }, [state.user?.id, supabase]);

  const stopTyping = useCallback(async (roomId: string) => {
    if (!state.user?.id) return;

    try {
      await supabase
        .from('typing_status')
        .upsert({
          user_id: state.user.id,
          room_id: roomId,
          is_typing: false,
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error stopping typing:', error);
    }
  }, [state.user?.id, supabase]);

  // Fixed fetchRoomsWithMembership function
  const fetchRoomsWithMembership = useCallback(async () => {
    if (!state.user) {
      console.log("❌ No user - skipping room fetch");
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    console.log("🔄 Starting room fetch for user:", state.user.id);
    dispatch({ type: "SET_LOADING", payload: true });
    
    try {
      // Get all rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from("rooms")
        .select("*")
        .order("created_at", { ascending: false });

      if (roomsError) {
        console.error("❌ Rooms fetch error:", roomsError);
        throw roomsError;
      }

      console.log("📦 Raw rooms data:", roomsData);

      if (!roomsData || roomsData.length === 0) {
        console.log("ℹ️ No rooms found in database");
        dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
        return;
      }

      // Get member counts using direct query (more reliable than RPC)
      const countsMap = await getAllRoomMemberCounts();
      console.log("👥 Member counts map:", Object.fromEntries(countsMap));

      // Process each room
      const roomsWithMembership: RoomWithMembershipCount[] = await Promise.all(
        roomsData.map(async (room) => { 
          try {
            // Type assertion for room - ensure it's properly typed
            const typedRoom = room as Room;
            const roomId = typedRoom.id;
            
            if (!roomId || !UUID_REGEX.test(roomId)) {
              console.error(`❌ Invalid room ID: ${roomId}`);
              throw new Error(`Invalid room ID: ${roomId}`);
            }

            console.log(`🔍 Processing room: ${typedRoom.name} (${roomId})`);
            
            // Check current user's membership status
            const userMembership = await checkUserRoomMembership(state.user!.id, roomId);
            console.log(`👤 Room ${typedRoom.name} membership:`, userMembership);
            
            // Get member count
            const memberCount = countsMap.get(roomId) || 0;
            
            // Get messages data
            const messagesData = await fetchRoomMessages(roomId);
            
            // Get online users count from presence
            const onlineUsers = getOnlineCount(roomId);

            const roomWithData: RoomWithMembershipCount = {
              ...typedRoom,
              memberCount,
              isMember: userMembership.isMember,
              participationStatus: userMembership.participationStatus,
              latestMessage: messagesData.latestMessage,
              unreadCount: messagesData.unreadCount,
              totalUsers: memberCount,
              onlineUsers: onlineUsers,
            };

            console.log(`✅ Processed room: ${typedRoom.name}`, {
              isMember: roomWithData.isMember,
              memberCount: roomWithData.memberCount,
              totalUsers: roomWithData.totalUsers,
              onlineUsers: roomWithData.onlineUsers
            });

            return roomWithData;
          } catch (error) {
            const typedRoom = room as Room;
            console.error(`❌ Error processing room ${typedRoom.name}:`, error);
            // Return a basic room object even if there's an error
            // FIXED: Add proper Room properties with type assertion
            return {
              ...typedRoom,
              memberCount: 0,
              isMember: false,
              participationStatus: null,
              latestMessage: undefined,
              unreadCount: 0,
              totalUsers: 0,
              onlineUsers: 0,
            } as RoomWithMembershipCount;
          }
        })
      );

      console.log("🎯 Final rooms with membership:", roomsWithMembership.map(r => ({
        name: r.name,
        isMember: r.isMember,
        memberCount: r.memberCount,
        totalUsers: r.totalUsers
      })));

      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: roomsWithMembership });
      
    } catch (error) {
      console.error("💥 Error fetching rooms with membership:", error);
      toast.error("Failed to load rooms");
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [state.user, supabase, checkUserRoomMembership, getAllRoomMemberCounts, fetchRoomMessages, getOnlineCount]);

  // acceptJoinNotification
  const acceptJoinNotification = useCallback(async (roomId: string) => {
    if (!state.user) {
      toast.error("Please log in to accept join request");
      return;
    }

    console.log("🔔 Accepting join notification for user:", {
      userId: state.user.id,
      userEmail: state.user.email,
      roomId
    });

    try {
      const res = await fetch(`/api/notifications/${roomId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: state.user.id,
          userEmail: state.user.email 
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept join request");
      }

      console.log("✅ Join request accepted:", data);

      // Refresh the room data after acceptance
      await refreshRoomData(roomId);
      
      // Update membership status
      dispatch({
        type: "UPDATE_ROOM_MEMBERSHIP",
        payload: { 
          roomId, 
          isMember: true, 
          participationStatus: "accepted" 
        },
      });

      toast.success(data.message || `Accepted join request successfully`);
    } catch (err: any) {
      console.error("[RoomContext] Error in acceptJoinNotification:", err);
      toast.error(err.message || "Failed to accept join request");
    }
  }, [state.user, refreshRoomData]);

  const checkRoomMembership = useCallback(async (roomId: string): Promise<boolean> => {
    if (!state.user) return false;
    
    try {
      const [memberResult, participantResult] = await Promise.all([
        supabase
          .from("room_members")
          .select("status")
          .eq("room_id", roomId)
          .eq("user_id", state.user.id),
        supabase
          .from("room_participants")
          .select("status")
          .eq("room_id", roomId)
          .eq("user_id", state.user.id)
      ]);
  
      if (memberResult.error || participantResult.error) {
        console.error("[RoomContext] Error checking room membership:", memberResult.error || participantResult.error);
        return false;
      }
  
      const memberStatus = memberResult.data?.[0]?.status;
      const participantStatus = participantResult.data?.[0]?.status;
  
      // Return true if accepted in either table
      return memberStatus === "accepted" || participantStatus === "accepted";
    } catch (err) {
      console.error("[RoomContext] Unexpected error in checkRoomMembership:", err);
      return false;
    }
  }, [state.user, supabase]);

  // checkRoomParticipation with proper typing
  const checkRoomParticipation = useCallback(async (roomId: string): Promise<string | null> => {
    if (!state.user) return null;
    
    try {
      const [memberResult, participantResult] = await Promise.all([
        supabase
          .from("room_members")
          .select("status")
          .eq("room_id", roomId)
          .eq("user_id", state.user.id),
        supabase
          .from("room_participants")
          .select("status")
          .eq("room_id", roomId)
          .eq("user_id", state.user.id)
      ]);

      const memberStatus = memberResult.data?.[0]?.status ?? null;
      const participantStatus = participantResult.data?.[0]?.status ?? null;

      if (memberStatus === "accepted" || participantStatus === "accepted") {
        return "accepted";
      } else if (memberStatus === "pending" || participantStatus === "pending") {
        return "pending";
      }

      return null;
    } catch (err) {
      console.error("[RoomContext] Unexpected error in checkRoomParticipation:", err);
      return null;
    }
  }, [state.user, supabase]);

  // Handle count updates with proper typing
  const handleCountUpdate = useCallback((room_id: string | undefined) => {
    if (!room_id) return;
    getRoomMemberCount(room_id).then((count) => {
      dispatch({
        type: "UPDATE_ROOM_MEMBER_COUNT",
        payload: { roomId: room_id, memberCount: count },
      });
    }).catch((err) => {
      console.error("[RoomContext] Error updating room count:", err);
    });
  }, [getRoomMemberCount]);

  // fetchAllUsers with proper typing
  const fetchAllUsers = useCallback(async (): Promise<PartialProfile[]> => {
    if (!state.user) return [];
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, created_at");
      
      if (error) {
        console.error("[RoomContext] Error fetching profiles:", error);
        return [];
      }
      
      return (data as PartialProfile[]) || [];
    } catch (error) {
      console.error("[RoomContext] Unexpected error fetching profiles:", error);
      return [];
    }
  }, [state.user, supabase]);

  // joinRoom with proper typing
  const joinRoom = useCallback(async (roomId: string) => {
    if (!roomId || roomId === 'undefined' || !UUID_REGEX.test(roomId)) {
      console.error("[RoomContext] Invalid roomId passed to joinRoom:", roomId);
      toast.error("Invalid room ID - cannot join.");
      dispatch({
        type: "UPDATE_ROOM_MEMBERSHIP",
        payload: { roomId: '', isMember: false, participationStatus: null },
      });
      return;
    }
  
    dispatch({
      type: "UPDATE_ROOM_MEMBERSHIP",
      payload: { roomId, isMember: false, participationStatus: "pending" },
    });
  
    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        dispatch({
          type: "UPDATE_ROOM_MEMBERSHIP",
          payload: { roomId, isMember: false, participationStatus: null },
        });
        throw new Error(data.error || "Failed to join room");
      }
      
      if (data.status === "accepted") {
        dispatch({
          type: "UPDATE_ROOM_MEMBERSHIP",
          payload: { roomId, isMember: true, participationStatus: "accepted" },
        });
        toast.success("Joined room successfully!");
        
        if (data.roomJoined && data.roomJoined.id) {
          const roomJoined: Room = {
            id: data.roomJoined.id,
            name: data.roomJoined.name,
            is_private: data.roomJoined.is_private,
            created_at: data.roomJoined.created_at,
            created_by: data.roomJoined.created_by,
          };
          const roomWithMembership: RoomWithMembershipCount = {
            ...roomJoined,
            isMember: true,
            participationStatus: "accepted",
            memberCount: data.memberCount ?? 0,
            latestMessage: undefined,
            unreadCount: 0,
            totalUsers: data.memberCount ?? 0,
            onlineUsers: 0,
          };
          dispatch({ type: "ADD_ROOM", payload: roomWithMembership });
        }
      }
      
      return data;
    } catch (error: any) {
      console.error("[RoomContext] Join room error:", error);
      toast.error(error.message || "Failed to join room");
      throw error;
    }
  }, [dispatch]);

  // leaveRoom with proper typing
  const leaveRoom = useCallback(async (roomId: string) => {
    if (!state.user) {
      toast.error("Please log in to leave a room");
      return;
    }
    dispatch({ type: "SET_IS_LEAVING", payload: true });
    try {
      const [membersResult, participantsResult] = await Promise.all([
        supabase
          .from("room_members")
          .delete()
          .eq("room_id", roomId)
          .eq("user_id", state.user.id),
        supabase
          .from("room_participants")
          .delete()
          .eq("room_id", roomId)
          .eq("user_id", state.user.id)
      ]);

      if (membersResult.error || participantsResult.error) {
        throw new Error(membersResult.error?.message || participantsResult.error?.message || "Failed to leave room");
      }

      toast.success("Successfully left the room");
      dispatch({ type: "REMOVE_ROOM", payload: roomId });
      dispatch({ type: "UPDATE_ROOM_MEMBERSHIP", payload: { roomId, isMember: false, participationStatus: null } });
      
      if (state.selectedRoom?.id === roomId) {
        const remainingRooms = state.availableRooms.filter((room) => room.id !== roomId);
        dispatch({ type: "SET_SELECTED_ROOM", payload: remainingRooms[0] || null });
      }
    } catch (error) {
      console.error("[RoomContext] Leave room error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to leave room");
    } finally {
      dispatch({ type: "SET_IS_LEAVING", payload: false });
    }
  }, [state.user, supabase, state.selectedRoom, state.availableRooms]);

  // switchRoom with proper typing
  const switchRoom = useCallback(async (newRoomId: string) => {
    if (!state.user) {
      toast.error("You must be logged in to switch rooms");
      return;
    }
    try {
      const response = await fetch(`/api/rooms/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: newRoomId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to switch room");
      const switchedRoom = state.availableRooms.find((r) => r.id === newRoomId);
      if (switchedRoom) {
        dispatch({ type: "SET_SELECTED_ROOM", payload: switchedRoom });
        toast.success(`Switched to ${switchedRoom.is_private ? "private" : "public"} room: ${switchedRoom.name}`);
      }
    } catch (err) {
      console.error("[RoomContext] Room switch failed:", err);
      toast.error("Failed to switch room");
    }
  }, [state.user, state.availableRooms]);

  // createRoom with proper typing
  const createRoom = useCallback(async (name: string, isPrivate: boolean) => {
    if (!state.user) {
      toast.error("You must be logged in to create a room");
      return;
    }
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), isPrivate }),
      });
      const newRoomResponse = await response.json();
      if (!response.ok) throw new Error(newRoomResponse.error || "Failed to create room");
      
      const newRoom: Room = {
        id: newRoomResponse.id,
        name: newRoomResponse.name,
        is_private: newRoomResponse.is_private,
        created_at: newRoomResponse.created_at,
        created_by: newRoomResponse.created_by || state.user.id,
      };
      
      toast.success("Room created successfully!");
      const roomWithMembership: RoomWithMembershipCount = {
        ...newRoom,
        isMember: true,
        participationStatus: "accepted",
        memberCount: 1,
        latestMessage: undefined,
        unreadCount: 0,
        totalUsers: 1,
        onlineUsers: 0,
      };
      dispatch({ type: "SET_SELECTED_ROOM", payload: roomWithMembership });
      dispatch({ type: "ADD_ROOM", payload: roomWithMembership });
    } catch (error) {
      console.error("[RoomContext] Create room error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create room");
    }
  }, [state.user]);

  const setSelectedRoom = useCallback((room: RoomWithMembershipCount | null) => {
    dispatch({ type: "SET_SELECTED_ROOM", payload: room });
  }, [dispatch]);

  const setSelectedDirectChat = useCallback((chat: DirectChat | null) => {
    dispatch({ type: "SET_SELECTED_DIRECT_CHAT", payload: chat });
  }, [dispatch]);

  // Auto-fetch rooms when user changes
  useEffect(() => {
    if (state.user?.id) fetchRoomsWithMembership();
  }, [state.user, fetchRoomsWithMembership]);

  // subscribe to changes on room_members and room_participants with proper typing
  useEffect(() => {
    const channel = supabase
      .channel("room-counts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members" },
        (payload) => {
          try {
            const newRoomId = (payload.new as { room_id?: string } | null)?.room_id;
            const oldRoomId = (payload.old as { room_id?: string } | null)?.room_id;
            const roomId = newRoomId || oldRoomId;
            
            if (roomId) {
              handleCountUpdate(roomId);
            }
          } catch (err) {
            console.error("[RoomProvider] room_members realtime handler error:", err);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants" },
        (payload) => {
          try {
            const newRoomId = (payload.new as { room_id?: string } | null)?.room_id;
            const oldRoomId = (payload.old as { room_id?: string } | null)?.room_id;
            const roomId = newRoomId || oldRoomId;
            
            if (roomId) {
              handleCountUpdate(roomId);
            }
          } catch (err) {
            console.error("[RoomProvider] room_participants realtime handler error:", err);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        console.warn("[RoomProvider] error removing room-counts channel:", err);
      }
    };
  }, [supabase, handleCountUpdate]);

  // handleScrollNotification with proper typing
  const handleScrollNotification = useCallback((isNearBottom: boolean, newUnreadDelta = 0) => {
    if (isNearBottom) {
      dispatch({ type: "RESET_UNREAD_NOTIFICATIONS", payload: 0 });
    } else {
      dispatch({ type: "RESET_UNREAD_NOTIFICATIONS", payload: state.unreadNotifications + newUnreadDelta });
    }
  }, [state.unreadNotifications]);
  
  // triggerScrollToBottom with proper typing
  const triggerScrollToBottom = useCallback(() => {
    if (scrollTriggerRef.current) {
      scrollTriggerRef.current();
    }
  }, []);
  

  const value: RoomContextType = {
    state,
    fetchAvailableRooms: fetchRoomsWithMembership,
    setSelectedRoom,
    setSelectedDirectChat,
    joinRoom,
    leaveRoom,
    switchRoom,
    createRoom,
    checkRoomMembership,
    checkRoomParticipation,
    addMessage,
    acceptJoinNotification,
    fetchAllUsers,
    updateTypingUsers,
    updateTypingText,
    fetchRoomMessages,
    fetchRoomUsers,
    refreshRoomData,
    messagesForRoom,
    typingDisplay: state.typingDisplayText,
    handleScrollNotification,
    triggerScrollToBottom,
    unreadNotifications: state.unreadNotifications,
    currentUser: state.user,
    currentUserId: state.user?.id || null,
    supabase,
    updateRoomPresence,
    getOnlineCount,
    getOnlineUsers,
    refreshPresence,
    presence: state.presence,
    getAllRoomMemberCounts,
    updateTypingUsersWithProfiles,
    startTyping,
    stopTyping,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  const context = useContext(RoomContext);
  if (context === undefined) throw new Error("useRoomContext must be used within a RoomProvider");
  return context;
}

// In your RoomContext.tsx file, update the test utility:
// FIXED: Add proper type assertions
export const extractPresenceDataForTest = (presenceState: RealtimePresenceState, currentUserId?: string): PresenceData[] => {
  const presenceData: PresenceData[] = [];
  
  try {
    Object.values(presenceState).forEach((presenceArray: any) => {
      if (Array.isArray(presenceArray)) {
        presenceArray.forEach((presence: any) => {
          // Type guard to check if it's a valid presence object
          if (presence && 
              typeof presence === 'object' && 
              'user_id' in presence && 
              typeof (presence as any).user_id === 'string') {
            
            const presenceObj = presence as any;
            
            // Skip current user if userId provided
            if (currentUserId && presenceObj.user_id === currentUserId) return;
            
            presenceData.push({
              user_id: String(presenceObj.user_id),
              online_at: presenceObj.online_at || new Date().toISOString(),
              room_id: presenceObj.room_id || '',
              display_name: presenceObj.display_name ? String(presenceObj.display_name) : 'Unknown User',
              username: presenceObj.username ? String(presenceObj.username) : '',
              last_seen: presenceObj.last_seen,
            });
          }
        });
      }
    });
  } catch (err) {
    console.error('Error extracting presence data:', err);
  }
  
  return presenceData;
};