"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, useMemo } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";
import { useMessage, Imessage } from "./messages";
// import { SafeSupabaseQuery } from "@/lib/utils/supabase-queries";

// ✅ FIX: Define UUID_REGEX at the top of the file (matches API/SearchComponent)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---- Types ----
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type DirectChat = Database["public"]["Tables"]["direct_chats"]["Row"];
type PartialProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

// Small cached profile shape used only for typing indicators
type CachedProfile = {
  display_name?: string;
  username?: string;
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

type TypingUser = {
  user_id: string;
  is_typing: boolean;
  display_name?: string;
  username?: string;
};

// ADDED: Missing types for MessageRow and ProfileRow
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

// Room member and participant types with explicit typing
// type RoomMember = { status: string | null };
// type RoomParticipant = { status: string };

// ---- State ----
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
}

// ---- Actions ----
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
        roomId: string; // FIXED: Changed String to string
        latestMessage?: string;
        unreadCount?: number;
        totalUsers?: number;
        onlineUsers?: number;
      };
    };

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
    default:
      return state;
  }
}

// ---- Context ----
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
  // ADD THESE:
  currentUser: SupabaseUser | null;
  currentUserId: string | null;
  supabase: ReturnType<typeof getSupabaseBrowserClient>;
}


const RoomContext = createContext<RoomContextType | undefined>(undefined);

// ---- Provider ----
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

  // MOVED UP: Call useMessage early to avoid hoisting errors
  const { addMessage: addMessageToStore, messages, optimisticIds, optimisticUpdateMessage, optimisticDeleteMessage } = useMessage();

  const addMessage = useCallback((message: Imessage) => {
    // Avoid duplicate messages
    if (!messages.some((m) => m.id === message.id)) {
      addMessageToStore(message);
    }
  }, [messages, addMessageToStore]);

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
    }
  }, [user]);

  // Helper functions for typing
  const updateTypingUsers = useCallback((users: TypingUser[]) => {
    dispatch({ type: "SET_TYPING_USERS", payload: users });
  }, []);

  const updateTypingText = useCallback((text: string) => {
    dispatch({ type: "SET_TYPING_TEXT", payload: text });
  }, []);

  // Fetch profile for user_ids (on demand, cache) - optimized
  const fetchProfiles = useCallback(async (userIds: string[]) => {
    const uncachedIds = userIds.filter((id) => !profilesCache.current.has(id));
    if (uncachedIds.length === 0) return;
  
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", uncachedIds);
  
    if (error) {
      console.error("Failed to fetch profiles:", error);
      return;
    }
  
    // Update cache with proper typing
    if (profiles) {
      profiles.forEach((profile) => {
        // FIXED: Explicitly type the profile properties and ensure they're strings
        const cachedProfile: CachedProfile = {
          display_name: typeof profile.display_name === 'string' ? profile.display_name : undefined,
          username: typeof profile.username === 'string' ? profile.username : undefined,
        };
        
        profilesCache.current.set(String(profile.id), cachedProfile);
      });
    }
  }, [supabase]);

  // Enhanced typing users update with profile fetching
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

  // Realtime typing subscription
  useEffect(() => {
    if (!state.selectedRoom?.id) return;

    const roomId = state.selectedRoom.id;
    const channel = supabase.channel(`typing:${roomId}`);

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_status",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const { data: typingRecords, error } = await supabase
            .from("typing_status")
            .select("user_id, is_typing, updated_at")
            .eq("room_id", roomId)
            .gt("updated_at", new Date(Date.now() - 5000).toISOString())
            .eq("is_typing", true);

          if (error) return;

          const typingUserIds = typingRecords?.map((record) => record.user_id as string) || [];
          await updateTypingUsersWithProfiles(typingUserIds);
        }
      )
      .subscribe();

    // Cleanup stale typing every 2s
    const interval = setInterval(async () => {
      const { data: typingRecords } = await supabase
        .from("typing_status")
        .select("user_id, is_typing, updated_at")
        .eq("room_id", roomId)
        .gt("updated_at", new Date(Date.now() - 5000).toISOString())
        .eq("is_typing", true);

      if (typingRecords) {
        const typingUserIds = typingRecords.map((record) => record.user_id as string);
        await updateTypingUsersWithProfiles(typingUserIds);
      } else {
        updateTypingUsers([]);
      }
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [state.selectedRoom?.id, supabase, updateTypingUsers, updateTypingUsersWithProfiles]);

  // Compute typing text from users
  useEffect(() => {
    const typingNames = state.typingUsers
      .map(user => user.display_name || user.username || "User")
      .filter(Boolean);

    let text = "";
    if (typingNames.length === 1) {
      text = `${typingNames[0]} is typing...`;
    } else if (typingNames.length === 2) {
      text = `${typingNames[0]} and ${typingNames[1]} are typing...`;
    } else if (typingNames.length > 2) {
      text = "Several people are typing...";
    }

    updateTypingText(text);
  }, [state.typingUsers, updateTypingText]);

  // FIXED: Memoized messagesForRoom with proper typing
  const messagesForRoom = useMemo(() => {
    if (!messages || !Array.isArray(messages) || !state.selectedRoom?.id) return [];
    return messages
      .filter((msg): msg is Imessage => msg && msg.room_id === state.selectedRoom!.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages, state.selectedRoom]);

  // NEW: Centralized realtime message handler
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

              // FIXED: Properly type the profile data
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

  // NEW: Realtime subscription for messages
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

  // FIXED: Utility function to check user room membership with proper typing and error handling
  const checkUserRoomMembership = useCallback(async (userId: string, roomId: string) => {
    try {
      const [membersResult, participantsResult] = await Promise.all([
        supabase
          .from("room_members")
          .select("status")
          .eq("room_id", roomId)
          .eq("user_id", userId),
        supabase
          .from("room_participants")
          .select("status")
          .eq("room_id", roomId)
          .eq("user_id", userId)
      ]);
  
      // Handle errors from either query
      if (membersResult.error) {
        console.error("Error fetching room members:", membersResult.error);
      }
      if (participantsResult.error) {
        console.error("Error fetching room participants:", participantsResult.error);
      }
  
      const memberStatus = membersResult.data?.[0]?.status ?? null;
      const participantStatus = participantsResult.data?.[0]?.status ?? null;
  
      const isAccepted = memberStatus === 'accepted' || participantStatus === 'accepted';
      const isPending = memberStatus === 'pending' || participantStatus === 'pending';
      
      return {
        isMember: isAccepted,
        participationStatus: memberStatus || participantStatus || null,
        isPending,
        isAccepted
      };
    } catch (error) {
      console.error(`Error checking membership for user ${userId} in room ${roomId}:`, error);
      return {
        isMember: false,
        participationStatus: null,
        isPending: false,
        isAccepted: false
      };
    }
  }, [supabase]);

  // FIXED: getRoomMemberCount with proper typing
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
  
  // FIXED: getAllRoomMemberCounts with proper typing
  const getAllRoomMemberCounts = useCallback(async (): Promise<Map<string, number>> => {
    try {
      const { data, error } = await supabase
        .rpc('get_room_user_counts');
  
      if (error) {
        console.error('Error fetching all room member counts:', error);
        return new Map();
      }
  
      // Convert array to Map with proper typing
      const countsMap = new Map<string, number>();
      if (data && Array.isArray(data)) {
        data.forEach((row: { room_id: string; user_count: number }) => {
          countsMap.set(row.room_id, row.user_count);
        });
      }
  
      return countsMap;
    } catch (error) {
      console.error('Error fetching all room member counts:', error);
      return new Map();
    }
  }, [supabase]);

  // FIXED: Function to fetch room messages with proper typing and error handling
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
  
      // Get unread count (messages from last 24 hours) - NOTE: Consider implementing proper unread logic based on user last_read
      const { count: unreadCountRaw, error: unreadError } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("room_id", roomId)
        .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
      if (unreadError) {
        console.error(`Error fetching unread count for room ${roomId}:`, unreadError);
      }
  
      // FIXED: Properly type the latest message text
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
  // FIXED: fetchRoomUsers with proper typing
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
      const onlineUsers = 0; // Placeholder - implement presence tracking if needed
  
      return { totalUsers, onlineUsers };
    } catch (error) {
      console.error(`Error fetching users for room ${roomId}:`, error);
      return { totalUsers: 0, onlineUsers: 0 };
    }
  }, [supabase]);

  // FIXED: Function to refresh individual room data
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

  // FIXED: Enhanced fetchRoomsWithMembership function with proper typing and scoping
// FIXED: Enhanced fetchRoomsWithMembership function with proper typing
const fetchRoomsWithMembership = useCallback(async () => {
  if (!state.user) {
    dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
    dispatch({ type: "SET_LOADING", payload: false });
    return;
  }

  dispatch({ type: "SET_LOADING", payload: true });
  
  try {
    // Get all rooms and member counts in parallel
    const [roomsResult, countsMap] = await Promise.all([
      supabase.from("rooms").select("*"),
      getAllRoomMemberCounts()
    ]);

    if (roomsResult.error) {
      throw roomsResult.error;
    }

    // FIXED: Assert the type of roomsData
    const roomsData = roomsResult.data as Room[] | null;
    if (!roomsData || roomsData.length === 0) {
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      return;
    }

    // Process each room with proper typing - FIXED: Type is now properly inferred
    const roomsWithMembership: RoomWithMembershipCount[] = await Promise.all(
      roomsData.map(async (room) => { 
        // Check current user's membership status
        const userMembership = await checkUserRoomMembership(state.user!.id, room.id);
        
        // Get member count from the pre-fetched map
        const memberCount = countsMap.get(room.id) || 0;
        
        // Get messages and user data
        const messagesData = await fetchRoomMessages(room.id);

        // FIXED: Ensure all Room properties are preserved and extended
        return {
          ...room,
          memberCount,
          isMember: userMembership.isMember,
          participationStatus: userMembership.participationStatus,
          latestMessage: messagesData.latestMessage,
          unreadCount: messagesData.unreadCount,
          totalUsers: memberCount,
          onlineUsers: 0,
        } as RoomWithMembershipCount;
      })
    );

    dispatch({ type: "SET_AVAILABLE_ROOMS", payload: roomsWithMembership });
  } catch (error) {
    console.error("[RoomContext] Error fetching rooms with membership:", error);
    toast.error("Failed to load rooms");
    dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
  } finally {
    dispatch({ type: "SET_LOADING", payload: false });
  }
}, [state.user, supabase, checkUserRoomMembership, getAllRoomMemberCounts, fetchRoomMessages]);
  // FIXED: acceptJoinNotification with proper typing and variable scoping
 // In your RoomContext - update acceptJoinNotification
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
      // You can send the user ID for verification if needed
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

  // FIXED: checkRoomParticipation with proper typing
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

  // FIXED: Handle count updates with proper typing
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

  // FIXED: fetchAllUsers with proper typing
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
      
      // Ensure proper typing
      return (data as PartialProfile[]) || [];
    } catch (error) {
      console.error("[RoomContext] Unexpected error fetching profiles:", error);
      return [];
    }
  }, [state.user, supabase]);

  // FIXED: joinRoom with proper typing
  const joinRoom = useCallback(async (roomId: string) => {
    // ✅ NEW FIX: Mirror API validation here to catch issues early (prevents invalid fetch)
    if (!roomId || roomId === 'undefined' || !UUID_REGEX.test(roomId)) {
      console.error("[RoomContext] Invalid roomId passed to joinRoom:", roomId);
      toast.error("Invalid room ID - cannot join.");
      // Reset optimistic update if any
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
        
        if (data.roomJoined && data.roomJoined.id) { // ✅ FIX: Guard against missing id in response
          // FIXED: Ensure full Room typing
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

  // FIXED: leaveRoom with proper typing
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

  // FIXED: switchRoom with proper typing
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

  // FIXED: createRoom with proper typing
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
      
      // FIXED: Ensure full Room typing
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

  // FIXED: subscribe to changes on room_members and room_participants with proper typing
  useEffect(() => {
    const channel = supabase
      .channel("room-counts")
      // For room_members handler
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members" },
        (payload) => {
          try {
            // FIXED: Proper type assertion for room_id
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
      // For room_participants handler (similar fix)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants" },
        (payload) => {
          try {
            // FIXED: Proper type assertion for room_id
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

  // FIXED: handleScrollNotification with proper typing
  const handleScrollNotification = useCallback((isNearBottom: boolean, newUnreadDelta = 0) => {
    if (isNearBottom) {
      dispatch({ type: "RESET_UNREAD_NOTIFICATIONS", payload: 0 });
    } else {
      dispatch({ type: "RESET_UNREAD_NOTIFICATIONS", payload: state.unreadNotifications + newUnreadDelta });
    }
  }, [state.unreadNotifications]);

  // FIXED: triggerScrollToBottom with proper typing
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
    // ADD THESE:
    currentUser: state.user,
    currentUserId: state.user?.id || null,
    supabase,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  const context = useContext(RoomContext);
  if (context === undefined) throw new Error("useRoomContext must be used within a RoomProvider");
  return context;
}