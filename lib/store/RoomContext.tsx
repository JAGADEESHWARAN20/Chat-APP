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
  is_typing: boolean;  // FIXED: boolean, not string
  display_name?: string;
  username?: string;
};

type RoomPresence = {
  [roomId: string]: {
    onlineUsers: number;
    lastUpdated: string;
  };
};

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
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

// ==================== PROVIDER ====================
export function RoomProvider({ children, user }: { children: React.ReactNode; user: SupabaseUser | undefined }) {
  const [state, dispatch] = useReducer(roomReducer, initialState);
  const supabase = supabaseBrowser();
  
  // Refs for optimization & loop prevention
  const presenceChannelsRef = useRef<Map<string, any>>(new Map());
  const typingCleanupRef = useRef<NodeJS.Timeout>();
  const profilesCacheRef = useRef<Map<string, { display_name?: string; username?: string }>>(new Map());
  const isFetchingRef = useRef(false);
  const lastFetchRef = useRef<number>(0);
  const roomPresenceRef = useRef<RoomPresence>({});

  // Update presence ref on change (stable snapshot)
  useEffect(() => {
    roomPresenceRef.current = { ...state.roomPresence };
  }, [state.roomPresence]);

  // ==================== CORE FUNCTIONS ====================
  const updateTypingUsers = useCallback((users: TypingUser[]) => {
    dispatch({ type: "SET_TYPING_USERS", payload: users });
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

  // ==================== ROOM OPERATIONS ====================

const handleCountUpdate = useCallback(
  async (room_id: string) => {
    if (!room_id) return;

    try {
      // Use server-side API to get accurate member counts (avoids RLS limits on client)
      const res = await fetch(`/api/rooms/all`);
      if (!res.ok) {
        console.error(`[handleCountUpdate] Failed to fetch /api/rooms/all for ${room_id}:`, await res.text());
        return;
      }

      const json = await res.json();
      const rooms = json?.rooms || json?.roomsWithMembership || [];
      const room = rooms.find((r: any) => r.id === room_id);

      const totalCount = room?.memberCount ?? 0;

      console.log(`[handleCountUpdate] (server) Room ${room_id}: ${totalCount} members`);

      dispatch({
        type: "UPDATE_ROOM_MEMBER_COUNT",
        payload: { roomId: room_id, memberCount: totalCount },
      });
    } catch (err) {
      console.error(`[handleCountUpdate] Unexpected error for ${room_id}:`, err);
    }
  },
  [dispatch]
);





  const fetchAvailableRooms = useCallback(async () => {
    // Debounce: Prevent rapid calls
    const now = Date.now();
    if (isFetchingRef.current || (now - lastFetchRef.current < 2000)) return;

    if (!user?.id) {
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      return;
    }

    isFetchingRef.current = true;
    lastFetchRef.current = now;
    
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Use server-side API which returns accurate member counts and membership status
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
        // Ensure optional fields exist on the typed object
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
      isFetchingRef.current = false;
    }
  }, [user?.id, dispatch]);  

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

      handleCountUpdate(roomId);

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
      const { error } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Left room successfully");

      dispatch({ type: "REMOVE_ROOM", payload: roomId });
      // Use the latest state snapshot from the ref to compute remaining rooms
      const currentRooms = stateRef.current.availableRooms.filter((r) => r.id !== roomId);
      const selected = stateRef.current.selectedRoom?.id === roomId ? currentRooms[0] || null : stateRef.current.selectedRoom;
      dispatch({ type: "SET_SELECTED_ROOM", payload: selected });

      // Update server-side counts for this room
      handleCountUpdate(roomId);

    } catch (error: any) {
      console.error("[Rooms] Leave error:", error);
      toast.error(error.message || "Failed to leave room");
    } finally {
      dispatch({ type: "SET_IS_LEAVING", payload: false });
    }
  }, [user?.id, supabase, handleCountUpdate]);

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

      // Refresh rooms and select the newly created room (fetchAvailableRooms returns the list)
      const refreshed = await fetchAvailableRooms();
      if (Array.isArray(refreshed)) {
        const createdRoom = refreshed.find((r: any) => r.id === newRoomResponse.id);
        if (createdRoom) dispatch({ type: "SET_SELECTED_ROOM", payload: createdRoom });
      }
    } catch (error: any) {
      console.error("[RoomContext] Create room error:", error);
      toast.error(error.message || "Failed to create room");
    }
  }, [user?.id, fetchAvailableRooms]);

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

  // Keep a stable ref to the latest state to avoid recreating callbacks that
  // otherwise depend on state and cause unnecessary re-renders of consumers.
  const stateRef = useRef<RoomState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ==================== EFFECTS ====================
  
  useEffect(() => {
    dispatch({ type: "SET_USER", payload: user ?? null });
  }, [user]);

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

  // ✅ FIXED: Presence tracking with stable dependencies
  // memberRoomIds: stable, sorted key of rooms where user is a member
  const memberRoomIds = useMemo(() =>
    state.availableRooms
      .filter(room => room.isMember)
      .map(room => room.id)
      .sort()
      .join(','),
    [state.availableRooms]
  );

  // Stable derived key for typing users to use in effects
  const typingUserIds = useMemo(
    () => state.typingUsers.map((u) => u.user_id).sort().join(","),
    [state.typingUsers]
  );

const trackAllRoomsPresence = useCallback(async () => {
  if (!user?.id || state.availableRooms.length === 0) return;

  const memberRooms = state.availableRooms.filter((room) => room.isMember);
  const currentRoomIds = new Set(memberRooms.map((room) => room.id));

    presenceChannelsRef.current.forEach((channel, roomId) => {
      if (!currentRoomIds.has(roomId)) {
        channel.unsubscribe();
        supabase.removeChannel(channel);
        presenceChannelsRef.current.delete(roomId);
      }
    });

    memberRooms.forEach((room) => {
      if (presenceChannelsRef.current.has(room.id)) return;

      const channel = supabase.channel(`room-presence:${room.id}`, {
        config: { presence: { key: room.id } }
      });

      const handlePresenceUpdate = () => {
        try {
          const presenceState = channel.presenceState();
          const onlineUsers = new Set<string>();
          
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
          
          console.log(`[Presence] Room ${room.name} (${room.id}):`, {
            onlineCount,
            userIds: Array.from(onlineUsers),
            rawState: presenceState
          });
          
          dispatch({
            type: "UPDATE_ROOM_PRESENCE",
            payload: { roomId: room.id, onlineUsers: onlineCount },
          });
        } catch (err) {
          console.error(`[Presence] Error for room ${room.id}:`, err);
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
              console.error(`[Presence] Track error:`, err);
            }
          }
        });

      presenceChannelsRef.current.set(room.id, channel);
    });
  }, [
    user?.id,
    supabase,
    state.availableRooms,
  ]);

  useEffect(() => {
    trackAllRoomsPresence();

    // snapshot channels for safe cleanup
    const channelsSnapshot = new Map(presenceChannelsRef.current);

    return () => {
      channelsSnapshot.forEach((channel) => {
        try {
          channel.unsubscribe();
          supabase.removeChannel(channel);
        } catch (err) {
          console.warn(`[Presence] Cleanup error:`, err);
        }
      });
      // replace the live ref map to avoid mutating while iterating elsewhere
      presenceChannelsRef.current = new Map();
    };
  }, [trackAllRoomsPresence, supabase]);


  // Typing status
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

      if (typingRecords?.length) {
        const typingUserIds = typingRecords.map((record) => record.user_id);
        
        const uncachedIds = typingUserIds.filter((id) => !profilesCacheRef.current.has(id));
        if (uncachedIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username, display_name")
            .in("id", uncachedIds);

          profiles?.forEach((profile: any) => {
            profilesCacheRef.current.set(profile.id, {
              display_name: profile.display_name || undefined,
              username: profile.username || undefined,
            });
          });
        }

        const typingUsers: TypingUser[] = typingUserIds.map((id) => {
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

    typingCleanupRef.current = setInterval(handleTypingUpdate, 2000);

    return () => {
      if (typingCleanupRef.current) clearInterval(typingCleanupRef.current);
      supabase.removeChannel(channel);
    };
  }, [state.selectedRoom?.id, user?.id, supabase, updateTypingUsers]);

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

  
useEffect(() => {
  if (!user?.id) return;

  console.log("[Real-time] Setting up SINGLE room members subscription");

  const channel = supabase
    .channel("room-members-realtime")
    .on(
      "postgres_changes",
      { 
        event: "INSERT", 
        schema: "public", 
        table: "room_members" 
      },
      async (payload: any) => {
        const roomId = payload.new?.room_id;
        console.log(`[Real-time INSERT] New member in room: ${roomId}`, payload.new);
        
        if (roomId) {
          // Update count after a short delay for database consistency
          setTimeout(() => {
            handleCountUpdate(roomId);
          }, 300);
        }
      }
    )
    .on(
      "postgres_changes",
      { 
        event: "DELETE", 
        schema: "public", 
        table: "room_members" 
      },
      async (payload: any) => {
        const roomId = payload.old?.room_id;
        console.log(`[Real-time DELETE] Member removed from room: ${roomId}`, payload.old);
        
        if (roomId) {
          setTimeout(() => {
            handleCountUpdate(roomId);
          }, 300);
        }
      }
    )
    .subscribe((status) => {
      console.log(`[Real-time] Room members subscription: ${status}`);
      if (status === 'SUBSCRIBED') {
        console.log('[Real-time] Successfully subscribed to room members changes');
      }
    });

  return () => {
    console.log("[Real-time] Cleaning up room members subscription");
    supabase.removeChannel(channel);
  };
}, [supabase, user?.id, handleCountUpdate]);

  const stateHash = [
  state.availableRooms.map(r => r.id).join(","),
  state.selectedRoom?.id,
  state.selectedDirectChat?.id,
  state.isLoading,
  state.isLeaving,
  state.user?.id,
  state.typingUsers.map(u => u.user_id).join(","),
  state.typingDisplayText,
  Object.keys(state.roomPresence).join(","),
].join("|");

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