"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  User as SupabaseUser,
} from "@supabase/supabase-js";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";
import {useMessage, Imessage } from "./messages";

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
}

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
  const supabase = supabaseBrowser();
  const profilesCache = useRef<Map<string, CachedProfile>>(new Map());

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

    // Update cache
    profiles?.forEach((profile: any) => {
      profilesCache.current.set(profile.id, {
        display_name: profile.display_name || undefined,
        username: profile.username || undefined,
      });
    });
  }, [supabase]);

  // Enhanced typing users update with profile fetching
  const updateTypingUsersWithProfiles = useCallback(
    async (userIds: string[]) => {
      if (!userIds || userIds.length === 0) {
        updateTypingUsers([]);
        return;
      }
      await fetchProfiles(userIds);

      const updatedTypingUsers: TypingUser[] = userIds.map((id) => {
        const profile = profilesCache.current.get(id);
        return {
          user_id: id,
          is_typing: true,
          display_name: profile?.display_name,
          username: profile?.username,
        } as TypingUser;
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
          const typingRecords = await supabase
            .from("typing_status")
            .select("user_id, is_typing, updated_at")
            .eq("room_id", roomId)
            .gt("updated_at", new Date(Date.now() - 5000).toISOString()) // Recent only (<5s)
            .eq("is_typing", true);

          if (typingRecords.error) return;

          const typingUserIds = typingRecords.data.map((record) => record.user_id);
          await updateTypingUsersWithProfiles(typingUserIds);
        }
      )
      .subscribe();

    // Cleanup stale typing every 2s
    const interval = setInterval(async () => {
      // Re-fetch recent to clear stale
      const typingRecords = await supabase
        .from("typing_status")
        .select("user_id, is_typing, updated_at")
        .eq("room_id", roomId)
        .gt("updated_at", new Date(Date.now() - 5000).toISOString())
        .eq("is_typing", true);

      if (typingRecords.data) {
        const typingUserIds = typingRecords.data.map((record) => record.user_id);
        await updateTypingUsersWithProfiles(typingUserIds);
      } else {
        updateTypingUsers([]);
      }
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [state.selectedRoom?.id, supabase, fetchProfiles, updateTypingUsers, updateTypingUsersWithProfiles]);

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

  // Utility function to check user room membership
  const checkUserRoomMembership = useCallback(async (userId: string, roomId: string) => {
    try {
      const [membersResult, participantsResult] = await Promise.all([
        supabase
          .from("room_members")
          .select("status")
          .eq("room_id", roomId)
          .eq("user_id", userId)
          .single(),
        
        supabase
          .from("room_participants")
          .select("status")
          .eq("room_id", roomId)
          .eq("user_id", userId)
          .single()
      ]);

      const memberStatus = membersResult.data?.status;
      const participantStatus = participantsResult.data?.status;

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
  
  const getAllRoomMemberCounts = useCallback(async (): Promise<Map<string, number>> => {
    try {
      const { data, error } = await supabase
        .rpc('get_room_user_counts');
  
      if (error) {
        console.error('Error fetching all room member counts:', error);
        return new Map();
      }
  
      // Convert array to Map
      const countsMap = new Map<string, number>();
      data?.forEach((row: { room_id: string; user_count: number }) => {
        countsMap.set(row.room_id, row.user_count);
      });
  
      return countsMap;
    } catch (error) {
      console.error('Error fetching all room member counts:', error);
      return new Map();
    }
  }, [supabase]);
  // Function to fetch room messages
  const fetchRoomMessages = useCallback(async (roomId: string) => {
    try {
      // Get latest message
      const { data: latestMessage } = await supabase
        .from("messages")
        .select("text, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Get unread count (messages from last 24 hours)
      const { count: unreadCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("room_id", roomId)
        .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      return {
        latestMessage: latestMessage?.text || "No messages yet",
        unreadCount: unreadCount || 0,
      };
    } catch (error) {
      console.error(`Error fetching messages for room ${roomId}:`, error);
      return {
        latestMessage: "No messages yet",
        unreadCount: 0,
      };
    }
  }, [supabase]);

  const fetchRoomUsers = useCallback(async (roomId: string) => {
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
      const onlineUsers = 0; // Placeholder
  
      return { totalUsers, onlineUsers };
    } catch (error) {
      console.error(`Error fetching users for room ${roomId}:`, error);
      return { totalUsers: 0, onlineUsers: 0 };
    }
  }, [supabase]);

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
    }
  }, [fetchRoomMessages, fetchRoomUsers, getRoomMemberCount]);

  // Enhanced fetchRoomsWithMembership function
// Enhanced fetchRoomsWithMembership function
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

    const roomsData = roomsResult.data;
    if (!roomsData || roomsData.length === 0) {
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      return;
    }

    // Process each room
    const roomsWithMembership: RoomWithMembershipCount[] = await Promise.all(
      roomsData.map(async (room) => {
        // Check current user's membership status
        const userMembership = await checkUserRoomMembership(state.user!.id, room.id);
        
        // Get member count from the pre-fetched map
        const memberCount = countsMap.get(room.id) || 0;
        
        // Get messages and user data
        const messagesData = await fetchRoomMessages(room.id);

        return {
          ...room,
          memberCount,
          isMember: userMembership.isMember,
          participationStatus: userMembership.participationStatus,
          latestMessage: messagesData.latestMessage,
          unreadCount: messagesData.unreadCount,
          totalUsers: memberCount, // Use the same count for total users
          onlineUsers: 0, // Placeholder
        };
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

  const acceptJoinNotification = useCallback(async (roomId: string) => {
    try {
      const res = await fetch(`/api/notifications/${roomId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept join request");
      }

      const roomWithMembership: RoomWithMembershipCount = {
        ...data.room,
        isMember: true,
        participationStatus: "accepted",
        memberCount: data.memberCount ?? 0,
      };

      dispatch({ type: "ADD_ROOM", payload: roomWithMembership });
      dispatch({ type: "SET_SELECTED_ROOM", payload: roomWithMembership });

      toast.success(data.message || `Accepted join request for ${data.room.name}`);
    } catch (err: any) {
      console.error("[RoomContext] Error in acceptJoinNotification:", err);
      toast.error(err.message || "Failed to update room after acceptance");
    }
  }, []);

  const checkRoomMembership = useCallback(async (roomId: string) => {
    if (!state.user) return false;
    const { data, error } = await supabase
      .from("room_members")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", state.user.id)
      .eq("status", "accepted");
    if (error) {
      console.error("[RoomContext] Error checking room membership:", error);
      return false;
    }
    return data && data.length > 0;
  }, [state.user, supabase]);

  const checkRoomParticipation = useCallback(async (roomId: string) => {
    if (!state.user) return null;
    const { data: memberStatus } = await supabase
      .from("room_members")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", state.user.id);
    const { data: participantStatus } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", state.user.id);

    let participationStatus = null;
    if (memberStatus && memberStatus.length > 0 && memberStatus[0].status === "accepted") participationStatus = "accepted";
    else if (participantStatus && participantStatus.length > 0 && participantStatus[0].status === "accepted") participationStatus = "accepted";
    else if (memberStatus && memberStatus.length > 0 && memberStatus[0].status === "pending") participationStatus = "pending";
    else if (participantStatus && participantStatus.length > 0 && participantStatus[0].status === "pending") participationStatus = "pending";

    return participationStatus;
  }, [state.user, supabase]);

  // Handle count updates
  const handleCountUpdate = useCallback((room_id: string | undefined) => {
    if (!room_id) return;
    getRoomMemberCount(room_id).then((count) => {
      dispatch({
        type: "UPDATE_ROOM_MEMBER_COUNT",
        payload: { roomId: room_id, memberCount: count },
      });
    });
  }, [getRoomMemberCount]);

  const fetchAllUsers = useCallback(async () => {
    if (!state.user) return [];
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, created_at");
      return data || [];
    } catch (error) {
      console.error("[RoomContext] Error fetching profiles:", error);
      return [];
    }
  }, [state.user, supabase]);

  const joinRoom = useCallback(async (roomId: string) => {
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
        
        if (data.roomJoined) {
          const roomWithMembership: RoomWithMembershipCount = {
            ...data.roomJoined,
            isMember: true,
            participationStatus: "accepted",
            memberCount: data.memberCount ?? 0,
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

  const leaveRoom = useCallback(async (roomId: string) => {
    if (!state.user) {
      toast.error("Please log in to leave a room");
      return;
    }
    dispatch({ type: "SET_IS_LEAVING", payload: true });
    try {
      const { error: membersError } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", state.user.id);
      const { error: participantsError } = await supabase
        .from("room_participants")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", state.user.id);
      if (membersError || participantsError) throw new Error(membersError?.message || participantsError?.message || "Failed to leave room");

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
  }, [state.user, supabase, state.selectedRoom, state.availableRooms, dispatch]);

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
  }, [state.user, state.availableRooms, dispatch]);

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
      
      toast.success("Room created successfully!");
      const roomWithMembership: RoomWithMembershipCount = {
        ...newRoomResponse,
        isMember: true,
        participationStatus: "accepted",
        memberCount: 1,
      };
      dispatch({ type: "SET_SELECTED_ROOM", payload: roomWithMembership });
      dispatch({ type: "ADD_ROOM", payload: roomWithMembership });
    } catch (error) {
      console.error("[RoomContext] Create room error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create room");
    }
  }, [state.user, dispatch]);

  const setSelectedRoom = useCallback((room: RoomWithMembershipCount | null) => {
    dispatch({ type: "SET_SELECTED_ROOM", payload: room });
  }, [dispatch]);

  const setSelectedDirectChat = useCallback((chat: DirectChat | null) => {
    dispatch({ type: "SET_SELECTED_DIRECT_CHAT", payload: chat });
  }, [dispatch]);

  const { addMessage: addMessageToStore, messages } = useMessage();

  const addMessage = useCallback((message: Imessage) => {
    // Avoid duplicate messages
    if (!messages.some((m) => m.id === message.id)) {
      addMessageToStore(message);
    }
  }, [messages, addMessageToStore]);

  // Auto-fetch rooms when user changes
  useEffect(() => {
    if (state.user?.id) fetchRoomsWithMembership();
  }, [state.user, fetchRoomsWithMembership]);

  // subscribe to changes on room_members and room_participants
  useEffect(() => {
    const channel = supabase
      .channel("room-counts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members" },
        (payload: { new: { room_id?: string } | null; old: { room_id?: string } | null }) => {
          try {
            const roomId = payload.new?.room_id ?? payload.old?.room_id;
            if (roomId) handleCountUpdate(roomId);
          } catch (err) {
            console.error("[RoomProvider] room_members realtime handler error:", err);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants" },
        (payload: { new: { room_id?: string } | null; old: { room_id?: string } | null }) => {
          try {
            const roomId = payload.new?.room_id ?? payload.old?.room_id;
            if (roomId) handleCountUpdate(roomId);
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
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  const context = useContext(RoomContext);
  if (context === undefined) throw new Error("useRoomContext must be used within a RoomProvider");
  return context;
}