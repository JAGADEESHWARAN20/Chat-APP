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
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
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
  lastTypingTime?: number;
};

type RoomPresence = {
  [roomId: string]: {
    onlineUsers: number;
    lastUpdated: string;
  };
};

type RoomMemberRow = {
  room_id: string;
  user_id: string;
  joined_at?: string;
};

// ==================== STATE & REDUCER ====================
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
  | { type: "SET_SELECTED_DIRECT_CHAT"; payload: DirectChat | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_IS_LEAVING"; payload: boolean }
  | { type: "SET_USER"; payload: SupabaseUser | null }
  | { type: "SET_TYPING_USERS"; payload: TypingUser[] }
  | { type: "SET_TYPING_TEXT"; payload: string }
  | { type: "UPDATE_ROOM_MEMBERSHIP"; payload: { roomId: string; isMember: boolean; participationStatus: string | null } }
  | { type: "UPDATE_ROOM_MEMBER_COUNT"; payload: { roomId: string; memberCount: number } }
  | { type: "UPDATE_ROOM_PRESENCE"; payload: { roomId: string; onlineUsers: number } }
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
    case "SET_SELECTED_DIRECT_CHAT":
      return { 
        ...state, 
        selectedDirectChat: action.payload, 
        selectedRoom: null 
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
          [action.payload.roomId]: { 
            onlineUsers: action.payload.onlineUsers, 
            lastUpdated: new Date().toISOString() 
          },
        },
        availableRooms: state.availableRooms.map((room) =>
          room.id === action.payload.roomId
            ? { ...room, onlineUsers: action.payload.onlineUsers }
            : room
        ),
        selectedRoom:
          state.selectedRoom?.id === action.payload.roomId
            ? { ...state.selectedRoom, onlineUsers: action.payload.onlineUsers }
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
  fetchAvailableRooms: () => Promise<RoomWithMembershipCount[] | void>;
  setSelectedRoom: (room: RoomWithMembershipCount | null) => void;
  setSelectedDirectChat: (chat: DirectChat | null) => void;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  switchRoom: (newRoomId: string) => void;
  createRoom: (name: string, isPrivate: boolean) => Promise<void>;
  checkRoomMembership: (roomId: string) => Promise<boolean>;
  addMessage: (message: Imessage) => void;
  fetchAllUsers: () => Promise<any[]>;
  updateTypingUsers: (users: TypingUser[]) => void;
  updateTypingText: (text: string) => void;
  getRoomPresence: (roomId: string) => { onlineUsers: number };
  startTyping: (roomId: string) => void;
  stopTyping: (roomId: string) => void;
  refreshMemberCount: (roomId: string) => Promise<void>;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

// ==================== FIXED PROVIDER ====================
export function RoomProvider({ children, user }: { children: React.ReactNode; user: SupabaseUser | undefined }) {
  const [state, dispatch] = useReducer(roomReducer, initialState);
  const supabase = getSupabaseBrowserClient();
  
  // Refs for optimization
  const presenceChannelsRef = useRef<Map<string, any>>(new Map());
  const typingChannelsRef = useRef<Map<string, any>>(new Map());
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const profilesCacheRef = useRef<Map<string, { display_name?: string; username?: string }>>(new Map());
  const isFetchingRef = useRef(false);
  const lastFetchRef = useRef<number>(0);
  const roomPresenceRef = useRef<RoomPresence>({});
  const stateRef = useRef<RoomState>(state);

  // Stable state reference
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Stable presence ref
  useEffect(() => {
    roomPresenceRef.current = { ...state.roomPresence };
  }, [state.roomPresence]);

  // ==================== FIXED CORE FUNCTIONS ====================
  const updateTypingUsers = useCallback((updater: TypingUser[] | ((prev: TypingUser[]) => TypingUser[])) => {
    if (typeof updater === "function") {
      dispatch({ type: "SET_TYPING_USERS", payload: updater(stateRef.current.typingUsers) });
    } else {
      dispatch({ type: "SET_TYPING_USERS", payload: updater });
    }
  }, []);

  const updateTypingText = useCallback((text: string) => {
    dispatch({ type: "SET_TYPING_TEXT", payload: text });
  }, []);

  const getRoomPresence = useCallback((roomId: string) => {
    const presence = roomPresenceRef.current[roomId];
    return {
      onlineUsers: presence?.onlineUsers ?? 0
    };
  }, []);

  const setSelectedRoom = useCallback((room: RoomWithMembershipCount | null) => {
    dispatch({ type: "SET_SELECTED_ROOM", payload: room });
  }, []);

  const setSelectedDirectChat = useCallback((chat: DirectChat | null) => {
    dispatch({ type: "SET_SELECTED_DIRECT_CHAT", payload: chat });
  }, []);

  // ==================== FIXED MEMBER COUNT LOGIC ====================
  const refreshMemberCount = useCallback(async (roomId: string) => {
    if (!roomId) return;
    try {
      const { count, error } = await supabase
        .from("room_members")
        .select("user_id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("status", "accepted");

      if (error) throw error;

      const memberCount = count ?? 0;

      dispatch({
        type: "UPDATE_ROOM_MEMBER_COUNT",
        payload: { roomId, memberCount },
      });

      // ✅ Keep selectedRoom synced
      const currentSelected = stateRef.current.selectedRoom;
      if (currentSelected?.id === roomId) {
        dispatch({
          type: "SET_SELECTED_ROOM",
          payload: { ...currentSelected, memberCount },
        });
      }
    } catch (err) {
      console.error(`[refreshMemberCount] Error for ${roomId}:`, err);
    }
  }, [supabase]);

  // ==================== IMPROVED REAL-TIME PRESENCE SYSTEM ====================
  const setupPresenceChannel = useCallback((roomId: string) => {
  if (!user?.id || presenceChannelsRef.current.has(roomId)) return;

  console.log(`[Presence] Setting up presence for room: ${roomId}`);

  const channel = supabase.channel(`room-presence:${roomId}`, {
    config: {
      presence: {
        key: user.id,
      },
      broadcast: { self: true }
    }
  });

    // Handle presence state changes
    const handlePresenceSync = () => {
      try {
        const presenceState = channel.presenceState();
        const onlineUsers = new Set<string>();
        
        // Count unique online users
        Object.values(presenceState).forEach((presences: any) => {
          if (Array.isArray(presences)) {
            presences.forEach((presence: any) => {
              if (presence?.user_id) {
                onlineUsers.add(presence.user_id);
              }
            });
          }
        });

        const onlineCount = onlineUsers.size;
        
        console.log(`[Presence] Room ${roomId}: ${onlineCount} online users`);
        
        dispatch({
          type: "UPDATE_ROOM_PRESENCE",
          payload: { roomId, onlineUsers: onlineCount },
        });
      } catch (err) {
        console.error(`[Presence] Error for room ${roomId}:`, err);
      }
    };

    // Subscribe to presence events
    channel
      .on("presence", { event: "sync" }, handlePresenceSync)
      .on("presence", { event: "join" }, handlePresenceSync)
      .on("presence", { event: "leave" }, handlePresenceSync)
      .subscribe(async (status: string) => {
        console.log(`[Presence] Room ${roomId} status:`, status);

        if (status === "SUBSCRIBED" && user?.id) {
          await channel.track({
            user_id: user.id,
            room_id: roomId,
            last_seen: new Date().toISOString(),
            online_at: new Date().toISOString(),
          });
        }
      });

    // ✅ Fix: re-sync on tab visibility changes (multi-tab)
   const handleVisibility = () => {
    if (document.visibilityState === "visible" && user?.id) {
      channel.track({
        user_id: user.id,
        room_id: roomId,
        last_seen: new Date().toISOString(),
        online_at: new Date().toISOString(),
      });
    }
   };
    
    document.addEventListener("visibilitychange", handleVisibility);

    presenceChannelsRef.current.set(roomId, channel);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      channel.unsubscribe();
    };
  }, [user?.id, supabase]);

  // ==================== IMPROVED TYPING INDICATOR SYSTEM ====================
  const setupTypingChannel = useCallback((roomId: string) => {
    if (!user?.id || typingChannelsRef.current.has(roomId)) return;

    console.log(`[Typing] Setting up typing channel for room: ${roomId}`);

    const channel = supabase.channel(`room-typing:${roomId}`, {
      config: {
        broadcast: { self: false } // Don't receive our own broadcasts
      }
    });

    const handleTypingBroadcast = async (event: any) => {
      try {
        const { payload } = event;
        if (payload.room_id !== roomId || payload.user_id === user.id) return;

        console.log(`[Typing] Received typing event from user:`, payload.user_id);

        // Get user profile if not cached
        if (!profilesCacheRef.current.has(payload.user_id)) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", payload.user_id)
            .single();

          if (profile) {
            profilesCacheRef.current.set(payload.user_id, {
              display_name: profile.display_name || undefined,
              username: profile.username || undefined,
            });
          }
        }

        const profile = profilesCacheRef.current.get(payload.user_id);
        const now = Date.now();

        if (payload.is_typing) {
          const newTypingUser: TypingUser = {
            user_id: payload.user_id,
            is_typing: true,
            display_name: profile?.display_name,
            username: profile?.username,
            lastTypingTime: now,
          };

          // Update typing users list
          updateTypingUsers(prev => {
            const filtered = prev.filter(u => u.user_id !== payload.user_id);
            return [...filtered, newTypingUser];
          });

          // Auto-remove typing indicator after 3 seconds
          const timeoutId = setTimeout(() => {
            updateTypingUsers(prev => prev.filter(u => u.user_id !== payload.user_id));
            typingTimeoutsRef.current.delete(payload.user_id);
          }, 3500);

          // Clear existing timeout for this user
          const existingTimeout = typingTimeoutsRef.current.get(payload.user_id);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
          }
          typingTimeoutsRef.current.set(payload.user_id, timeoutId);
        } else {
          // Remove user from typing list
          updateTypingUsers(prev => 
            prev.filter(u => u.user_id !== payload.user_id)
          );
          
          // Clear timeout
          const existingTimeout = typingTimeoutsRef.current.get(payload.user_id);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
            typingTimeoutsRef.current.delete(payload.user_id);
          }
        }
      } catch (err) {
        console.error(`[Typing] Broadcast handling error:`, err);
      }
    };

    channel
      .on("broadcast", { event: "typing" }, handleTypingBroadcast)
      .subscribe((status: string) => {
        console.log(`[Typing] Room ${roomId} typing channel status:`, status);
      });

    typingChannelsRef.current.set(roomId, channel);
    return channel;
  }, [user?.id, supabase, updateTypingUsers]);

// ==================== IMPROVED TYPING FUNCTIONS ====================
// Define stopTyping first to avoid circular dependency
const stopTyping = useCallback((roomId: string) => {
  if (!user?.id || !roomId) return;

  const channel = typingChannelsRef.current.get(roomId);
  if (!channel) return;

  console.log(`[Typing] User ${user.id} stopped typing in room ${roomId}`);

  // Clear timeout
  const timeout = typingTimeoutsRef.current.get(user.id);
  if (timeout) {
    clearTimeout(timeout);
    typingTimeoutsRef.current.delete(user.id);
  }

  // Send typing stop event
  channel.send({
    type: "broadcast",
    event: "typing",
    payload: {
      user_id: user.id,
      room_id: roomId,
      is_typing: false,
      timestamp: new Date().toISOString(),
    },
  });
}, [user]);

const startTyping = useCallback((roomId: string) => {
  if (!user?.id || !roomId) return;

  const channel = typingChannelsRef.current.get(roomId);
  if (!channel) return;

  console.log(`[Typing] User ${user.id} started typing in room ${roomId}`);
  
  // Clear existing timeout
  const timeout = typingTimeoutsRef.current.get(user.id);
  if (timeout) clearTimeout(timeout);

  // Send typing start event
  channel.send({
    type: "broadcast",
    event: "typing",
    payload: {
      user_id: user.id,
      room_id: roomId,
      is_typing: true,
      timestamp: new Date().toISOString(),
    },
  });

  // Auto stop typing after 2 seconds if no further activity
  const newTimeout = setTimeout(() => {
    stopTyping(roomId);
  }, 2000);

  typingTimeoutsRef.current.set(user.id, newTimeout);
}, [user, stopTyping]);

  // ==================== ROOM OPERATIONS ====================
  const fetchAvailableRooms = useCallback(async () => {
    const now = Date.now();
    if (isFetchingRef.current || (now - lastFetchRef.current < 3000)) return;

    if (!user?.id) {
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      return;
    }

    isFetchingRef.current = true;
    lastFetchRef.current = now;
    
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const res = await fetch(`/api/rooms/all`);
      if (!res.ok) {
        const text = await res.text();
        console.error("[fetchAvailableRooms] /api/rooms/all failed:", text);
        dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
        return;
      }

      const json = await res.json();
      const rooms = json?.rooms || json?.roomsWithMembership || [];

      const roomsWithMembership: RoomWithMembershipCount[] = rooms.map((room: any) => ({
        id: room.id,
        name: room.name,
        is_private: room.is_private,
        created_by: room.created_by,
        created_at: room.created_at,
        isMember: !!room.isMember,
        participationStatus: room.participationStatus ?? null,
        memberCount: room.memberCount ?? 0,
        unreadCount: room.unreadCount ?? 0,
        latestMessage: room.latestMessage ?? undefined,
        onlineUsers: roomPresenceRef.current[room.id]?.onlineUsers ?? 0,
      }));

      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: roomsWithMembership });
      return roomsWithMembership;

    } catch (error) {
      console.error("[Rooms] Error fetching rooms:", error);
      toast.error("Failed to load rooms");
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      return [];
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
      setTimeout(() => {
        isFetchingRef.current = false;
      }, 1000);
    }
  }, [user?.id]);

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
        
        // Setup real-time features for the joined room
        setupPresenceChannel(roomId);
        setupTypingChannel(roomId);
        refreshMemberCount(roomId);
      }

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
  }, [user?.id, setupPresenceChannel, setupTypingChannel, refreshMemberCount]);

  const leaveRoom = useCallback(async (roomId: string) => {
    if (!user?.id) {
      toast.error("Please log in to leave rooms");
      return;
    }

    dispatch({ type: "SET_IS_LEAVING", payload: true });

    try {
      const { error } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Left room successfully");

      // Cleanup real-time channels
      const presenceChannel = presenceChannelsRef.current.get(roomId);
      if (presenceChannel) {
        presenceChannel.unsubscribe();
        presenceChannelsRef.current.delete(roomId);
      }

      const typingChannel = typingChannelsRef.current.get(roomId);
      if (typingChannel) {
        typingChannel.unsubscribe();
        typingChannelsRef.current.delete(roomId);
      }

      dispatch({ type: "REMOVE_ROOM", payload: roomId });
      
      // Update member count for the room
      refreshMemberCount(roomId);

    } catch (error: any) {
      console.error("[Rooms] Leave error:", error);
      toast.error(error.message || "Failed to leave room");
    } finally {
      dispatch({ type: "SET_IS_LEAVING", payload: false });
    }
  }, [user?.id, supabase, refreshMemberCount]);

  const switchRoom = useCallback((newRoomId: string) => {
    const switchedRoom = stateRef.current.availableRooms.find((room) => room.id === newRoomId);
    if (switchedRoom) {
      dispatch({ type: "SET_SELECTED_ROOM", payload: switchedRoom });
    }
  }, []);

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

      const newRoomResponse = await response.json();

      if (!response.ok) {
        throw new Error(newRoomResponse.error || "Failed to create room");
      }

      toast.success("Room created successfully!");

      // Refresh rooms and select the newly created room
      const refreshed = await fetchAvailableRooms();
      if (Array.isArray(refreshed)) {
        const createdRoom = refreshed.find((r: any) => r.id === newRoomResponse.id);
        if (createdRoom) {
          dispatch({ type: "SET_SELECTED_ROOM", payload: createdRoom });
          // Setup real-time features for the new room
          setupPresenceChannel(createdRoom.id);
          setupTypingChannel(createdRoom.id);
          refreshMemberCount(createdRoom.id);
        }
      }
    } catch (error: any) {
      console.error("[RoomContext] Create room error:", error);
      toast.error(error.message || "Failed to create room");
    }
  }, [user?.id, fetchAvailableRooms, setupPresenceChannel, setupTypingChannel, refreshMemberCount]);

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
        .select("id, username, display_name, avatar_url, created_at");

      return data || [];
    } catch (error) {
      console.error("[RoomContext] Error fetching profiles:", error);
      return [];
    }
  }, [user?.id, supabase]);

  const { addMessage: addMessageToStore, messages } = useMessage();

  const addMessage = useCallback((message: Imessage) => {
    if (!messages.some((m) => m.id === message.id)) {
      addMessageToStore(message);
    }
  }, [messages, addMessageToStore]);

  // ==================== REAL-TIME MEMBER COUNT UPDATES ====================
  useEffect(() => {
    if (!user?.id) return;

    const roomMembersSubscription = supabase
      .channel("room-members-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_members",
        },
        async (payload: any) => {
          const newData = payload.new as RoomMemberRow | null;
          const oldData = payload.old as RoomMemberRow | null;
          const roomId = newData?.room_id ?? oldData?.room_id;

          if (roomId) {
            console.log(
              `[Real-time] Room members changed for ${roomId} (${payload.eventType})`,
              payload
            );

            // Debounce refresh to avoid duplicate triggers
            setTimeout(() => refreshMemberCount(roomId), 400);
          }
        }
      )
      .subscribe((status: string) => {
        console.log(`[Real-time] Room members subscription: ${status}`);
      });

    return () => {
      supabase.removeChannel(roomMembersSubscription);
    };
  }, [user?.id, supabase, refreshMemberCount]);

// ==================== OPTIMIZED REAL-TIME FEATURES FOR MEMBER ROOMS ====================
useEffect(() => {
  if (!user?.id || state.availableRooms.length === 0) return;

  const memberRooms = state.availableRooms.filter((room) => room.isMember);
  console.log(`[Real-time] Setting up features for ${memberRooms.length} member rooms`);

  // Store cleanup functions
  const cleanupFunctions: (() => void)[] = [];

  // Setup presence and typing for all member rooms
  memberRooms.forEach((room) => {
    const presenceCleanup = setupPresenceChannel(room.id);
    const typingChannel = setupTypingChannel(room.id);
    
    if (presenceCleanup) cleanupFunctions.push(presenceCleanup);
    
    refreshMemberCount(room.id);
  });

  // ✅ FIX: Store the actual cleanup logic in a variable
  const cleanup = () => {
    console.log(`[Real-time] Cleaning up real-time features`);
    
    // Use ref.current directly but store in a named function
    typingChannelsRef.current.forEach((channel) => channel.unsubscribe());
    typingChannelsRef.current.clear();

    typingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    typingTimeoutsRef.current.clear();
    
    cleanupFunctions.forEach(cleanupFn => cleanupFn());
  };

  return cleanup;
}, [user?.id, state.availableRooms, setupPresenceChannel, setupTypingChannel, refreshMemberCount]);
  
  // ✅ Always restore presence & typing when user switches rooms
  useEffect(() => {
    if (state.selectedRoom?.id && user?.id) {
      setupPresenceChannel(state.selectedRoom.id);
      setupTypingChannel(state.selectedRoom.id);
      refreshMemberCount(state.selectedRoom.id);
    }
  }, [state.selectedRoom?.id, user?.id, setupPresenceChannel, setupTypingChannel, refreshMemberCount]);

  // Update typing text when typing users change
  const typingUserIds = useMemo(() => 
    state.typingUsers.map(u => u.user_id).sort().join(','),
    [state.typingUsers]
  );

  useEffect(() => {
    const typingNames = state.typingUsers
      .map((user) => user.display_name || user.username || "User")
      .filter(Boolean);

    let text = "";
    if (typingNames.length === 1) text = `${typingNames[0]} is typing...`;
    else if (typingNames.length === 2) text = `${typingNames[0]} and ${typingNames[1]} are typing...`;
    else if (typingNames.length > 2) text = "Several people are typing...";

    updateTypingText(text);
  }, [typingUserIds, state.typingUsers, updateTypingText]);

  // Initial user setup
  useEffect(() => {
    dispatch({ type: "SET_USER", payload: user ?? null });
  }, [user]);

  // Initial fetch when user changes
  useEffect(() => {
    if (user?.id) {
      fetchAvailableRooms();
    } else {
      dispatch({ type: "BATCH_UPDATE_ROOMS", payload: { 
        availableRooms: [], 
        selectedRoom: null, 
        selectedDirectChat: null,
        typingUsers: [], 
        typingDisplayText: "" 
      }});
    }
  }, [user?.id, fetchAvailableRooms]);

  // Context value
  const contextValue = useMemo(
    (): RoomContextType => ({
      state,
      fetchAvailableRooms,
      setSelectedRoom,
      setSelectedDirectChat,
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
      startTyping,
      stopTyping,
      refreshMemberCount,
    }),
    [
      state,
      fetchAvailableRooms,
      setSelectedRoom,
      setSelectedDirectChat,
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
      startTyping,
      stopTyping,
      refreshMemberCount,
    ]
  );

  return <RoomContext.Provider value={contextValue}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  const context = useContext(RoomContext);
  if (context === undefined) {
    throw new Error("useRoomContext must be used within a RoomProvider");
  }
  return context;
}