// lib/store/RoomContext.tsx - FIXED VERSION
"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";
import { useMessage, Imessage } from "./messages";

// ==================== TYPES ====================
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type DirectChat = Database["public"]["Tables"]["direct_chats"]["Row"];

export type RoomWithMembershipCount = Room & {
  isMember: boolean;
  participationStatus: string | null;
  memberCount: number;
  unreadCount?: number;
  latestMessage?: string;
  onlineUsers?: number;
};

type TypingUser = {
  user_id: string;
  is_typing: boolean;
  display_name?: string;
  username?: string;
};

type RoomPresence = {
  [roomId: string]: {
    onlineUsers: number;
    userPresence: Map<string, { user_id: string; online_at: string }>;
    lastUpdated: string;
  };
};

// Payload types for real-time subscriptions
type RoomMembersPayload = {
  new: { room_id?: string } | null;
  old: { room_id?: string } | null;
};

// ==================== STATE ====================
interface RoomState {
  availableRooms: RoomWithMembershipCount[];
  selectedRoom: RoomWithMembershipCount | null;
  selectedDirectChat: DirectChat | null;
  isLoading: boolean;
  isLeaving: boolean;
  user: SupabaseUser | null;
  typingUsers: TypingUser[];
  typingDisplayText: string;
  roomPresence: RoomPresence;
}

type RoomAction =
  | { type: "SET_AVAILABLE_ROOMS"; payload: RoomWithMembershipCount[] }
  | { type: "SET_SELECTED_ROOM"; payload: RoomWithMembershipCount | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_IS_LEAVING"; payload: boolean }
  | { type: "SET_USER"; payload: SupabaseUser | null }
  | { type: "SET_TYPING_USERS"; payload: TypingUser[] }
  | { type: "SET_TYPING_TEXT"; payload: string }
  | { type: "UPDATE_ROOM_MEMBERSHIP"; payload: { roomId: string; isMember: boolean; participationStatus: string | null } }
  | { type: "UPDATE_ROOM_MEMBER_COUNT"; payload: { roomId: string; memberCount: number } }
  | { type: "UPDATE_ROOM_PRESENCE"; payload: { roomId: string; presence: RoomPresence[string] } }
  | { type: "REMOVE_ROOM"; payload: string }
  | { type: "ADD_ROOM"; payload: RoomWithMembershipCount }
  | { type: "BATCH_UPDATE_ROOMS"; payload: Partial<RoomState> };

const initialState: RoomState = {
  availableRooms: [],
  selectedRoom: null,
  selectedDirectChat: null,
  isLoading: false,
  isLeaving: false,
  user: null,
  typingUsers: [],
  typingDisplayText: "",
  roomPresence: {},
};

// ==================== REDUCER ====================
function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case "SET_AVAILABLE_ROOMS":
      return { ...state, availableRooms: action.payload };
    case "SET_SELECTED_ROOM":
      return { 
        ...state, 
        selectedRoom: action.payload, 
        selectedDirectChat: null 
      };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
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
                participationStatus: action.payload.participationStatus 
              }
            : room
        ),
        selectedRoom:
          state.selectedRoom?.id === action.payload.roomId
            ? { 
                ...state.selectedRoom, 
                isMember: action.payload.isMember, 
                participationStatus: action.payload.participationStatus 
              }
            : state.selectedRoom,
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
            : state.selectedRoom,
      };
    case "UPDATE_ROOM_PRESENCE":
      return {
        ...state,
        roomPresence: {
          ...state.roomPresence,
          [action.payload.roomId]: action.payload.presence,
        },
        availableRooms: state.availableRooms.map((room) =>
          room.id === action.payload.roomId
            ? { ...room, onlineUsers: action.payload.presence.onlineUsers }
            : room
        ),
        selectedRoom:
          state.selectedRoom?.id === action.payload.roomId
            ? { ...state.selectedRoom, onlineUsers: action.payload.presence.onlineUsers }
            : state.selectedRoom,
      };
    case "REMOVE_ROOM":
      return {
        ...state,
        availableRooms: state.availableRooms.filter((room) => room.id !== action.payload),
        selectedRoom: state.selectedRoom?.id === action.payload ? null : state.selectedRoom,
      };
    case "ADD_ROOM":
      return { 
        ...state, 
        availableRooms: [...state.availableRooms, action.payload] 
      };
    case "BATCH_UPDATE_ROOMS":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// ==================== CONTEXT ====================
interface RoomContextType {
  state: RoomState;
  fetchAvailableRooms: () => Promise<void>;
  setSelectedRoom: (room: RoomWithMembershipCount | null) => void;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  switchRoom: (newRoomId: string) => Promise<void>;
  createRoom: (name: string, isPrivate: boolean) => Promise<void>;
  checkRoomMembership: (roomId: string) => Promise<boolean>;
  addMessage: (message: Imessage) => void;
  fetchAllUsers: () => Promise<any[]>;
  updateTypingUsers: (users: TypingUser[]) => void;
  updateTypingText: (text: string) => void;
  getRoomPresence: (roomId: string) => { onlineUsers: number; userCount: number };
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

// ==================== PROVIDER ====================
export function RoomProvider({ children, user }: { children: React.ReactNode; user: SupabaseUser | undefined }) {
  const [state, dispatch] = useReducer(roomReducer, initialState);
  const supabase = supabaseBrowser();
  
  // Refs for optimization
  const presenceChannelsRef = useRef<Map<string, any>>(new Map());
  const typingCleanupRef = useRef<NodeJS.Timeout>();
  const profilesCacheRef = useRef<Map<string, { display_name?: string; username?: string }>>(new Map());
  const roomMemberCountsRef = useRef<Map<string, number>>(new Map());

  // ==================== TYPING FUNCTIONS ====================
  
  const updateTypingUsers = useCallback((users: TypingUser[]) => {
    dispatch({ type: "SET_TYPING_USERS", payload: users });
  }, []);

  const updateTypingText = useCallback((text: string) => {
    dispatch({ type: "SET_TYPING_TEXT", payload: text });
  }, []);

  // ==================== ROOM OPERATIONS ====================

  const handleCountUpdate = useCallback(async (room_id: string) => {
    try {
      // Count ACCEPTED members from BOTH tables
      const { count: membersCount, error: membersError } = await supabase
        .from("room_members")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room_id)
        .eq("status", "accepted");

      const { count: participantsCount, error: participantsError } = await supabase
        .from("room_participants")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room_id)
        .eq("status", "accepted");

      if (membersError || participantsError) {
        console.error(`[Count] Error counting for ${room_id}:`, membersError || participantsError);
        return;
      }

      const totalCount = (membersCount ?? 0) + (participantsCount ?? 0);
      roomMemberCountsRef.current.set(room_id, totalCount);

      dispatch({
        type: "UPDATE_ROOM_MEMBER_COUNT",
        payload: { roomId: room_id, memberCount: totalCount },
      });

    } catch (error) {
      console.error(`[Count] Error updating count for ${room_id}:`, error);
    }
  }, [supabase]);

  const fetchAvailableRooms = useCallback(async () => {
    if (!user?.id) {
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Fetch all rooms
      const { data: allRooms, error: roomsError } = await supabase
        .from("rooms")
        .select("id, name, is_private, created_by, created_at");

      if (roomsError) throw roomsError;

      if (!allRooms || allRooms.length === 0) {
        dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
        return;
      }

      const roomIds = allRooms.map((r) => r.id);

      // Get current user's membership status from both tables
      const { data: memberships } = await supabase
        .from("room_members")
        .select("room_id, status")
        .in("room_id", roomIds)
        .eq("user_id", user.id);

      const { data: participations } = await supabase
        .from("room_participants")
        .select("room_id, status")
        .in("room_id", roomIds)
        .eq("user_id", user.id);

      const membershipMap = new Map<string, string | null>();
      (memberships || []).forEach((m) => membershipMap.set(m.room_id, m.status));
      (participations || []).forEach((p) => {
        if (!membershipMap.has(p.room_id)) membershipMap.set(p.room_id, p.status);
      });

      // Count ACCEPTED members from both tables
      const { data: acceptedMembersData, error: membersError } = await supabase
        .from("room_members")
        .select("room_id")
        .in("room_id", roomIds)
        .eq("status", "accepted");

      const { data: acceptedParticipantsData, error: participantsError } = await supabase
        .from("room_participants")
        .select("room_id")
        .in("room_id", roomIds)
        .eq("status", "accepted");

      if (membersError || participantsError) {
        console.error("[Rooms] Error counting members:", membersError || participantsError);
      }

      // Create a map to count members per room
      const memberCounts = new Map<string, number>();
      roomIds.forEach((roomId) => memberCounts.set(roomId, 0));

      // Count accepted members
      (acceptedMembersData || []).forEach(({ room_id }) => {
        memberCounts.set(room_id, (memberCounts.get(room_id) || 0) + 1);
      });

      // Count accepted participants and add to total
      (acceptedParticipantsData || []).forEach(({ room_id }) => {
        memberCounts.set(room_id, (memberCounts.get(room_id) || 0) + 1);
      });

      const roomsWithMembership: RoomWithMembershipCount[] = allRooms.map((room) => ({
        ...room,
        memberCount: memberCounts.get(room.id) || 0,
        isMember: (membershipMap.get(room.id) ?? null) === "accepted",
        participationStatus: membershipMap.get(room.id) ?? null,
        onlineUsers: state.roomPresence[room.id]?.onlineUsers ?? 0,
      }));

      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: roomsWithMembership });

    } catch (error) {
      console.error("[Rooms] Error fetching rooms:", error);
      toast.error("Failed to load rooms");
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [user?.id, supabase, state.roomPresence]);

  const joinRoom = useCallback(async (roomId: string) => {
    if (!user?.id) {
      toast.error("Please log in to join rooms");
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
        throw new Error(data.error || "Failed to join room");
      }

      if (data.status === "accepted") {
        dispatch({
          type: "UPDATE_ROOM_MEMBERSHIP",
          payload: { roomId, isMember: true, participationStatus: "accepted" },
        });
        
        toast.success("Joined room successfully!");
      }

      // Update count in background without triggering full fetch
      await handleCountUpdate(roomId);

      return data;
    } catch (error: any) {
      console.error("[Rooms] Join error:", error);
      dispatch({
        type: "UPDATE_ROOM_MEMBERSHIP",
        payload: { roomId, isMember: false, participationStatus: null },
      });
      toast.error(error.message || "Failed to join room");
      throw error;
    }
  }, [user?.id, handleCountUpdate]);

  const leaveRoom = useCallback(async (roomId: string) => {
    if (!user?.id) {
      toast.error("Please log in to leave rooms");
      return;
    }

    dispatch({ type: "SET_IS_LEAVING", payload: true });

    try {
      const { error: membersError } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      const { error: participantsError } = await supabase
        .from("room_participants")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (membersError || participantsError) {
        throw membersError || participantsError;
      }

      toast.success("Left room successfully");
      
      dispatch({ type: "REMOVE_ROOM", payload: roomId });
      
      if (state.selectedRoom?.id === roomId) {
        const remainingRooms = state.availableRooms.filter(room => room.id !== roomId);
        dispatch({ type: "SET_SELECTED_ROOM", payload: remainingRooms[0] || null });
      }

      // Update count in background
      await handleCountUpdate(roomId);

    } catch (error: any) {
      console.error("[Rooms] Leave error:", error);
      toast.error(error.message || "Failed to leave room");
    } finally {
      dispatch({ type: "SET_IS_LEAVING", payload: false });
    }
  }, [user?.id, state.selectedRoom, state.availableRooms, supabase, handleCountUpdate]);

  const switchRoom = useCallback(async (newRoomId: string) => {
    const switchedRoom = state.availableRooms.find(room => room.id === newRoomId);
    if (switchedRoom) {
      dispatch({ type: "SET_SELECTED_ROOM", payload: switchedRoom });
    }
  }, [state.availableRooms]);

  const createRoom = useCallback(async (name: string, isPrivate: boolean) => {
    if (!user?.id) {
      toast.error("Please log in to create rooms");
      return;
    }

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), isPrivate }),
      });

      const newRoom = await response.json();

      if (!response.ok) {
        throw new Error(newRoom.error || "Failed to create room");
      }

      const roomWithMembership: RoomWithMembershipCount = {
        ...newRoom,
        isMember: true,
        participationStatus: "accepted",
        memberCount: 1,
        onlineUsers: 1, // Creator is online
      };

      dispatch({ type: "ADD_ROOM", payload: roomWithMembership });
      dispatch({ type: "SET_SELECTED_ROOM", payload: roomWithMembership });

      toast.success("Room created successfully!");

    } catch (error: any) {
      console.error("[Rooms] Create error:", error);
      toast.error(error.message || "Failed to create room");
      throw error;
    }
  }, [user?.id]);

  const checkRoomMembership = useCallback(async (roomId: string) => {
    if (!user?.id) return false;
    
    const { data } = await supabase
      .from("room_members")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .eq("status", "accepted");

    return !!(data && data.length > 0);
  }, [user?.id, supabase]);

  const fetchAllUsers = useCallback(async () => {
    if (!user?.id) return [];
    
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, created_at")
        .limit(100);

      return data || [];
    } catch (error) {
      console.error("[Users] Fetch error:", error);
      return [];
    }
  }, [user?.id, supabase]);

  const { addMessage: addMessageToStore, messages } = useMessage();

  const addMessage = useCallback((message: Imessage) => {
    if (!messages.some(m => m.id === message.id)) {
      addMessageToStore(message);
    }
  }, [messages, addMessageToStore]);

  const getRoomPresence = useCallback((roomId: string) => {
    const presence = state.roomPresence[roomId];
    return {
      onlineUsers: presence?.onlineUsers ?? 0,
      userCount: presence?.userPresence?.size ?? 0
    };
  }, [state.roomPresence]);

  const setSelectedRoom = useCallback((room: RoomWithMembershipCount | null) => {
    dispatch({ type: "SET_SELECTED_ROOM", payload: room });
  }, []);

  // ==================== EFFECTS ====================
  
  // User management
  useEffect(() => {
    dispatch({ type: "SET_USER", payload: user ?? null });
  }, [user]);

  // Auto-fetch rooms when user changes - FIXED: Use useCallback reference
  useEffect(() => {
    if (user?.id) {
      fetchAvailableRooms();
    } else {
      dispatch({ type: "BATCH_UPDATE_ROOMS", payload: { 
        availableRooms: [], 
        selectedRoom: null, 
        typingUsers: [], 
        typingDisplayText: "" 
      }});
    }
  }, [user?.id, fetchAvailableRooms]);

  // ==================== PRESENCE SYSTEM ====================
  
  const trackAllRoomsPresence = useCallback(async () => {
    if (!user?.id || state.availableRooms.length === 0) return;

    const memberRooms = state.availableRooms.filter(room => room.isMember);

    // Clean up unused channels first
    const currentRoomIds = new Set(memberRooms.map(room => room.id));
    presenceChannelsRef.current.forEach((channel, roomId) => {
      if (!currentRoomIds.has(roomId)) {
        channel.unsubscribe();
        supabase.removeChannel(channel);
        presenceChannelsRef.current.delete(roomId);
      }
    });

    // Subscribe to member rooms
    memberRooms.forEach(async (room) => {
      if (presenceChannelsRef.current.has(room.id)) return;

      const channel = supabase.channel(`room-presence:${room.id}`, {
        config: {
          presence: { key: room.id }
        }
      });

      const handlePresenceUpdate = () => {
        try {
          const presenceState = channel.presenceState();
          const userPresence = new Map<string, { user_id: string; online_at: string }>();
          const onlineUsers = new Set<string>();

          Object.values(presenceState).forEach((presences: any) => {
            if (Array.isArray(presences)) {
              presences.forEach((presence: any) => {
                if (presence?.user_id) {
                  onlineUsers.add(presence.user_id);
                  userPresence.set(presence.user_id, {
                    user_id: presence.user_id,
                    online_at: presence.online_at || new Date().toISOString()
                  });
                }
              });
            }
          });

          const onlineCount = onlineUsers.size;
          
          dispatch({
            type: "UPDATE_ROOM_PRESENCE",
            payload: {
              roomId: room.id,
              presence: {
                onlineUsers: onlineCount,
                userPresence,
                lastUpdated: new Date().toISOString()
              }
            }
          });

        } catch (err) {
          console.error(`[Presence] Error updating presence for room ${room.id}:`, err);
        }
      };

      channel
        .on("presence", { event: "sync" }, handlePresenceUpdate)
        .on("presence", { event: "join" }, handlePresenceUpdate)
        .on("presence", { event: "leave" }, handlePresenceUpdate)
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && user?.id) {
            try {
              await channel.track({
                user_id: user.id,
                room_id: room.id,
                online_at: new Date().toISOString(),
              });
            } catch (err) {
              console.error(`[Presence] Error tracking presence:`, err);
            }
          }
        });

      presenceChannelsRef.current.set(room.id, channel);
    });
  }, [user?.id, state.availableRooms, supabase]);

  // Presence effect - FIXED CLEANUP
  useEffect(() => {
    trackAllRoomsPresence();

    return () => {
      // Store channels in a variable for cleanup
      const channels = new Map(presenceChannelsRef.current);
      channels.forEach((channel, roomId) => {
        try {
          channel.unsubscribe();
          supabase.removeChannel(channel);
        } catch (err) {
          console.warn(`[Presence] Error cleaning up channel ${roomId}:`, err);
        }
      });
      presenceChannelsRef.current.clear();
    };
  }, [trackAllRoomsPresence, supabase]);

  // ==================== TYPING SYSTEM ====================
  
  // Typing subscription for selected room only
  useEffect(() => {
    if (!state.selectedRoom?.id || !user?.id) return;

    const roomId = state.selectedRoom.id;
    const channel = supabase.channel(`typing:${roomId}`);

    const handleTypingUpdate = async () => {
      const { data: typingRecords } = await supabase
        .from("typing_status")
        .select("user_id, is_typing, updated_at")
        .eq("room_id", roomId)
        .gt("updated_at", new Date(Date.now() - 5000).toISOString())
        .eq("is_typing", true);

      if (typingRecords) {
        const typingUserIds = typingRecords.map(record => record.user_id);
        
        // Fetch profiles for uncached users
        const uncachedIds = typingUserIds.filter(id => !profilesCacheRef.current.has(id));
        if (uncachedIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username, display_name")
            .in("id", uncachedIds);

          profiles?.forEach(profile => {
            profilesCacheRef.current.set(profile.id, {
              display_name: profile.display_name || undefined,
              username: profile.username || undefined,
            });
          });
        }

        const typingUsers: TypingUser[] = typingUserIds.map(id => {
          const profile = profilesCacheRef.current.get(id);
          return {
            user_id: id,
            is_typing: true,
            display_name: profile?.display_name,
            username: profile?.username,
          };
        });

        updateTypingUsers(typingUsers);
      } else {
        updateTypingUsers([]);
      }
    };

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_status",
          filter: `room_id=eq.${roomId}`,
        },
        handleTypingUpdate
      )
      .subscribe();

    // Auto-cleanup stale typing
    typingCleanupRef.current = setInterval(handleTypingUpdate, 2000);

    return () => {
      if (typingCleanupRef.current) {
        clearInterval(typingCleanupRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [state.selectedRoom?.id, user?.id, supabase, updateTypingUsers]);

  // Auto-update typing text
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

  // ==================== REAL-TIME SUBSCRIPTIONS ====================

  // Real-time member count updates for both tables
  useEffect(() => {
    const channel = supabase
      .channel("room-members-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members" },
        (payload: RoomMembersPayload) => {
          const roomId = payload.new?.room_id ?? payload.old?.room_id;
          if (roomId) {
            handleCountUpdate(roomId);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants" },
        (payload: RoomMembersPayload) => {
          const roomId = payload.new?.room_id ?? payload.old?.room_id;
          if (roomId) {
            handleCountUpdate(roomId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, handleCountUpdate]);

  // ==================== CONTEXT VALUE ====================

  const contextValue = useMemo((): RoomContextType => ({
    state,
    fetchAvailableRooms,
    setSelectedRoom,
    joinRoom,
    leaveRoom,
    switchRoom,
    createRoom,
    checkRoomMembership,
    addMessage,
    fetchAllUsers,
    updateTypingUsers,
    updateTypingText,
    getRoomPresence,
  }), [
    state,
    fetchAvailableRooms,
    setSelectedRoom,
    joinRoom,
    leaveRoom,
    switchRoom,
    createRoom,
    checkRoomMembership,
    addMessage,
    fetchAllUsers,
    updateTypingUsers,
    updateTypingText,
    getRoomPresence,
  ]);

  return (
    <RoomContext.Provider value={contextValue}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoomContext() {
  const context = useContext(RoomContext);
  if (context === undefined) {
    throw new Error("useRoomContext must be used within a RoomProvider");
  }
  return context;
}