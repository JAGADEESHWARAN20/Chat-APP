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

export type RoomWithMembershipCount = Room & {
  isMember: boolean;
  participationStatus: string | null;
  memberCount: number;
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
  | { type: "ADD_ROOM"; payload: RoomWithMembershipCount };

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
  handleTyping: () => void;
  stopTyping: () => void;
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

  // Typing refs and callbacks
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserId = state.user?.id ?? null;
  const chatId = state.selectedRoom?.id ?? state.selectedDirectChat?.id ?? null;
  const canOperateTyping = Boolean(chatId && currentUserId);

  // Typing functions
  const startTyping = useCallback(() => {
    if (!canOperateTyping || !typingChannelRef.current) return;
    const payload: TypingUser = {
      user_id: currentUserId!,
      is_typing: true,
      display_name: state.user?.user_metadata?.display_name,
      username: state.user?.user_metadata?.username,
    };
    typingChannelRef.current.send({ type: "broadcast", event: "typing_start", payload });
  }, [canOperateTyping, currentUserId, state.user]);

  const stopTyping = useCallback(() => {
    if (!canOperateTyping || !typingChannelRef.current) return;
    typingChannelRef.current.send({ type: "broadcast", event: "typing_stop", payload: { user_id: currentUserId!, is_typing: false } });
  }, [canOperateTyping, currentUserId]);

  const handleTyping = useCallback(() => {
    if (!canOperateTyping) return;
    startTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => stopTyping(), 3000); // 3s debounce
  }, [startTyping, stopTyping, canOperateTyping]);

  // Typing channel setup
  useEffect(() => {
    if (!canOperateTyping) {
      dispatch({ type: "SET_TYPING_USERS", payload: [] });
      dispatch({ type: "SET_TYPING_TEXT", payload: "" });
      return;
    }

    const channel = supabase.channel(`typing-${chatId}`);
    channel
      // For typing_start (around line 245)
.on("broadcast", { event: "typing_start" }, ({ payload }: { payload: TypingUser }) => {
  if (payload.user_id === currentUserId) return;
  
  // FIXED: Compute new array BEFORE dispatch (no updater fn)
  const newTypingUsers = (state.typingUsers as TypingUser[]).map((u) =>
    u.user_id === payload.user_id ? { ...u, is_typing: true } : u
  );
  if (!newTypingUsers.some((u) => u.user_id === payload.user_id)) {
    newTypingUsers.push({ ...payload, is_typing: true });
  }
  
  dispatch({ type: "SET_TYPING_USERS", payload: newTypingUsers });
})

// For typing_stop (around line 258)
.on("broadcast", { event: "typing_stop" }, ({ payload }: { payload: { user_id: string } }) => {
  // FIXED: Compute new array BEFORE dispatch (no updater fn)
  const newTypingUsers = (state.typingUsers as TypingUser[]).filter((u) => u.user_id !== payload.user_id);
  
  dispatch({ type: "SET_TYPING_USERS", payload: newTypingUsers });
})
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      stopTyping();
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
      dispatch({ type: "SET_TYPING_USERS", payload: [] });
      dispatch({ type: "SET_TYPING_TEXT", payload: "" });
    };
  }, [supabase, chatId, canOperateTyping, currentUserId, startTyping, stopTyping]);

  // Compute typing display text
  useEffect(() => {
    const active = state.typingUsers.filter((u) => u.is_typing);
    let text = "";
    if (active.length > 0) {
      const names = active.map(
        (u) => u.display_name || u.username || `User ${u.user_id.slice(-4)}`
      );
      if (active.length === 1) {
        text = `${names[0]} is typing...`;
      } else if (active.length === 2) {
        text = `${names[0]} and ${names[1]} are typing...`;
      } else {
        text = `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]} are typing...`;
      }
    }
    dispatch({ type: "SET_TYPING_TEXT", payload: text });
  }, [state.typingUsers]);

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
    }
  }, [user]);

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

  const handleCountUpdate = useCallback(async (room_id: string | undefined) => {
    if (!room_id) return;
    const { count: membersCount } = await supabase
      .from("room_members")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room_id)
      .eq("status", "accepted");
    const { count: participantsCount } = await supabase
      .from("room_participants")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room_id)
      .eq("status", "accepted");
    const totalCount = (membersCount ?? 0) + (participantsCount ?? 0);
    dispatch({ type: "UPDATE_ROOM_MEMBER_COUNT", payload: { roomId: room_id, memberCount: totalCount } });
  }, [supabase]);

  const fetchAvailableRooms = useCallback(async () => {
    if (!state.user) {
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const { data: allRooms } = await supabase
        .from("rooms")
        .select("id, name, is_private, created_by, created_at");

      if (!allRooms || allRooms.length === 0) {
        dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
        dispatch({ type: "SET_LOADING", payload: false });
        return;
      }

      const roomIds = allRooms.map((r) => r.id);

      const { data: memberships } = await supabase
        .from("room_members")
        .select("room_id, status")
        .in("room_id", roomIds)
        .eq("user_id", state.user.id);

      const { data: participations } = await supabase
        .from("room_participants")
        .select("room_id, status")
        .in("room_id", roomIds)
        .eq("user_id", state.user.id);

      const membershipMap = new Map<string, string | null>();
      (memberships || []).forEach((m) => membershipMap.set(m.room_id, m.status));
      (participations || []).forEach((p) => {
        if (!membershipMap.has(p.room_id)) membershipMap.set(p.room_id, p.status);
      });

      const { data: membersData } = await supabase
        .from("room_members")
        .select("room_id, user_id")
        .in("room_id", roomIds)
        .eq("status", "accepted");

      const { data: participantsData } = await supabase
        .from("room_participants")
        .select("room_id, user_id")
        .in("room_id", roomIds)
        .eq("status", "accepted");

      let countsMap = new Map<string, number>();
      const uniqueUsers = new Map<string, Set<string>>();
      (membersData || []).forEach((m) => {
        if (!uniqueUsers.has(m.room_id)) uniqueUsers.set(m.room_id, new Set());
        uniqueUsers.get(m.room_id)!.add(m.user_id);
      });
      (participantsData || []).forEach((p) => {
        if (!uniqueUsers.has(p.room_id)) uniqueUsers.set(p.room_id, new Set());
        uniqueUsers.get(p.room_id)!.add(p.user_id);
      });
      countsMap = new Map([...uniqueUsers].map(([roomId, users]) => [roomId, users.size]));

      const roomsWithMembership: RoomWithMembershipCount[] = allRooms.map((room) => ({
        ...room,
        memberCount: countsMap.get(room.id) ?? 0,
        isMember: (membershipMap.get(room.id) ?? null) === "accepted",
        participationStatus: membershipMap.get(room.id) ?? null,
      }));

      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: roomsWithMembership });
    } catch (error) {
      console.error("[RoomContext] Error fetching rooms:", error);
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      toast.error("An error occurred while fetching rooms");
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [state.user, supabase]);

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
  

  // Real-time subscriptions
 // 🧠 FIXED: Realtime channel subscription (Supabase v2 syntax)
useEffect(() => {
  if (!canOperateTyping) {
    dispatch({ type: "SET_TYPING_USERS", payload: [] });
    dispatch({ type: "SET_TYPING_TEXT", payload: "" });
    return;
  }

  // Create typing channel
  const channel = supabase.channel(`typing-${chatId}`, {
    config: {
      broadcast: { self: false }, // ✅ correct prop, no postgres_changes
      presence: { key: currentUserId ?? "anon" },
    },
  });

  // Listen for typing_start
  channel.on(
    "broadcast",
    { event: "typing_start" },
    ({ payload }: { payload: TypingUser }) => {
      if (payload.user_id === currentUserId) return;

      const newTypingUsers = [...state.typingUsers];
      const existing = newTypingUsers.find((u) => u.user_id === payload.user_id);
      if (existing) {
        existing.is_typing = true;
      } else {
        newTypingUsers.push({ ...payload, is_typing: true });
      }
      dispatch({ type: "SET_TYPING_USERS", payload: newTypingUsers });
    }
  );

  // Listen for typing_stop
  channel.on(
    "broadcast",
    { event: "typing_stop" },
    ({ payload }: { payload: { user_id: string } }) => {
      const newTypingUsers = state.typingUsers.filter(
        (u) => u.user_id !== payload.user_id
      );
      dispatch({ type: "SET_TYPING_USERS", payload: newTypingUsers });
    }
  );

  // ✅ Correct subscribe call (no "postgres_changes")
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.log(`[Typing Channel] Connected → ${chatId}`);
    }
  });

  typingChannelRef.current = channel;

  return () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    stopTyping();
    if (typingChannelRef.current) {
      supabase.removeChannel(typingChannelRef.current);
      typingChannelRef.current = null;
    }
    dispatch({ type: "SET_TYPING_USERS", payload: [] });
    dispatch({ type: "SET_TYPING_TEXT", payload: "" });
  };
}, [supabase, chatId, canOperateTyping, currentUserId, startTyping, stopTyping, state.typingUsers]);


  useEffect(() => {
    if (state.user?.id) fetchAvailableRooms();
  }, [state.user, fetchAvailableRooms]);

  const value: RoomContextType = {
    state,
    fetchAvailableRooms,
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
    handleTyping,
    stopTyping,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  const context = useContext(RoomContext);
  if (context === undefined) throw new Error("useRoomContext must be used within a RoomProvider");
  return context;
}