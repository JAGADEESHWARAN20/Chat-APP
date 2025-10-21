// lib/store/RoomContext.tsx (Updated with comprehensive console logging)
"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  User as SupabaseUser,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";
import { Imessage } from "./messages";

// ---- Types ----
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomMemberRow = Database["public"]["Tables"]["room_members"]["Row"];
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

// ---- State ----
interface RoomState {
  availableRooms: RoomWithMembershipCount[];
  selectedRoom: RoomWithMembershipCount | null;
  selectedDirectChat: DirectChat | null;
  isLoading: boolean;
  isMember: boolean;
  isLeaving: boolean;
  user: SupabaseUser | null;
}

type RoomAction =
  | { type: "SET_AVAILABLE_ROOMS"; payload: RoomWithMembershipCount[] }
  | { type: "SET_SELECTED_ROOM"; payload: RoomWithMembershipCount | null }
  | { type: "SET_SELECTED_DIRECT_CHAT"; payload: DirectChat | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_IS_MEMBER"; payload: boolean }
  | { type: "SET_IS_LEAVING"; payload: boolean }
  | { type: "SET_USER"; payload: SupabaseUser | null }
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
};

function roomReducer(state: RoomState, action: RoomAction): RoomState {
  console.log("[RoomContext] 🎛️ Reducer Action:", action.type, {
    payload: action.payload,
    currentState: {
      selectedRoom: state.selectedRoom?.id,
      availableRoomsCount: state.availableRooms.length,
      user: state.user?.id
    }
  });

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

  // Log user information whenever it changes
  useEffect(() => {
    console.log("[RoomContext] 👤 User State Update:", {
      userId: user?.id,
      email: user?.email,
      username: user?.user_metadata?.username,
      displayName: user?.user_metadata?.display_name,
      fullUser: user
    });
    dispatch({ type: "SET_USER", payload: user ?? null });
  }, [user]);

  useEffect(() => {
    if (!user) {
      console.log("[RoomContext] 🚫 No user - clearing rooms and selections");
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      dispatch({ type: "SET_SELECTED_ROOM", payload: null });
      dispatch({ type: "SET_SELECTED_DIRECT_CHAT", payload: null });
    }
  }, [user]);

  const acceptJoinNotification = useCallback(
    async (roomId: string) => {
      console.log("[RoomContext] 📥 Accepting join notification for room:", roomId, {
        currentUserId: state.user?.id,
        currentUsername: state.user?.user_metadata?.username,
        currentDisplayName: state.user?.user_metadata?.display_name
      });
      
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

        console.log("[RoomContext] ✅ Join request accepted:", {
          roomId: data.room?.id,
          roomName: data.room?.name,
          memberCount: data.memberCount
        });

        dispatch({ type: "ADD_ROOM", payload: roomWithMembership });
        dispatch({ type: "SET_SELECTED_ROOM", payload: roomWithMembership });

        toast.success(data.message || `Accepted join request for ${data.room.name}`);
      } catch (err: any) {
        console.error("[RoomContext] ❌ Error in acceptJoinNotification:", err);
        toast.error(err.message || "Failed to update room after acceptance");
      }
    },
    [state.user]
  );

  const checkRoomMembership = useCallback(
    async (roomId: string) => {
      console.log("[RoomContext] 🔍 Checking room membership:", {
        roomId,
        currentUserId: state.user?.id,
        currentUsername: state.user?.user_metadata?.username
      });
      
      if (!state.user) return false;
      const { data, error } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", state.user.id)
        .eq("status", "accepted");
      if (error) {
        console.error("[RoomContext] ❌ Error checking room membership:", error);
        return false;
      }
      
      const isMember = data && data.length > 0 && data[0].status === "accepted";
      console.log("[RoomContext] 🔍 Room membership result:", { roomId, isMember });
      return isMember;
    },
    [state.user, supabase]
  );

  const checkRoomParticipation = useCallback(
    async (roomId: string) => {
      console.log("[RoomContext] 🔍 Checking room participation:", {
        roomId,
        currentUserId: state.user?.id,
        currentUsername: state.user?.user_metadata?.username
      });
      
      if (!state.user) return null;
      const { data: memberStatus, error: memberError } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", state.user.id);
      if (memberError) console.error("[RoomContext] ❌ Error checking room membership for participation status:", memberError);

      const { data: participantStatus, error: participantError } = await supabase
        .from("room_participants")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", state.user.id);
      if (participantError) console.error("[RoomContext] ❌ Error checking room participation status:", participantError);

      let participationStatus = null;
      if (memberStatus && memberStatus.length > 0 && memberStatus[0].status === "accepted") participationStatus = "accepted";
      if (participantStatus && participantStatus.length > 0 && participantStatus[0].status === "accepted") participationStatus = "accepted";
      if (memberStatus && memberStatus.length > 0 && memberStatus[0].status === "pending") participationStatus = "pending";
      if (participantStatus && participantStatus.length > 0 && participantStatus[0].status === "pending") participationStatus = "pending";
      
      console.log("[RoomContext] 🔍 Room participation result:", { roomId, participationStatus });
      return participationStatus;
    },
    [state.user, supabase]
  );

  const handleCountUpdate = useCallback(async (room_id: string | undefined) => {
    if (!room_id) {
      console.log("[RoomContext] ⚠️  No room_id provided for count update");
      return;
    }
    
    console.log("[RoomContext] 🔢 Updating member count for room:", room_id);
    
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
    
    console.log("[RoomContext] 🔢 Member count result:", {
      roomId: room_id,
      membersCount,
      participantsCount,
      totalCount
    });
    
    dispatch({ type: "UPDATE_ROOM_MEMBER_COUNT", payload: { roomId: room_id, memberCount: totalCount } });
  }, [supabase]);

  const fetchAvailableRooms = useCallback(async () => {
    console.log("[RoomContext] 📂 Fetching available rooms:", {
      currentUserId: state.user?.id,
      currentUsername: state.user?.user_metadata?.username,
      currentDisplayName: state.user?.user_metadata?.display_name
    });

    if (!state.user) {
      console.log("[RoomContext] 🚫 No user - skipping room fetch");
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const { data: allRooms, error: roomsError } = await supabase
        .from("rooms")
        .select("id, name, is_private, created_by, created_at");

      if (roomsError) {
        console.error("[RoomContext] ❌ Error fetching all rooms:", roomsError);
        dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
        dispatch({ type: "SET_LOADING", payload: false });
        return;
      }

      if (!allRooms || allRooms.length === 0) {
        console.log("[RoomContext] ℹ️  No rooms found in database");
        dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
        dispatch({ type: "SET_LOADING", payload: false });
        return;
      }

      console.log("[RoomContext] 📦 Found rooms:", allRooms.map(r => ({ id: r.id, name: r.name, is_private: r.is_private })));

      const roomIds = allRooms.map((r) => r.id);

      const { data: memberships, error: membersError } = await supabase
        .from("room_members")
        .select("room_id, status")
        .in("room_id", roomIds)
        .eq("user_id", state.user.id);

      const { data: participations, error: participantsError } = await supabase
        .from("room_participants")
        .select("room_id, status")
        .in("room_id", roomIds)
        .eq("user_id", state.user.id);

      if (membersError || participantsError) {
        console.error("[RoomContext] ❌ Error fetching memberships/participations:", membersError || participantsError);
        dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
        dispatch({ type: "SET_LOADING", payload: false });
        return;
      }

      console.log("[RoomContext] 👥 User memberships:", memberships);
      console.log("[RoomContext] 👥 User participations:", participations);

      const membershipMap = new Map<string, string | null>();
      (memberships || []).forEach((m) => membershipMap.set(m.room_id, m.status));
      (participations || []).forEach((p) => {
        if (!membershipMap.has(p.room_id)) membershipMap.set(p.room_id, p.status);
      });

      const { data: membersData, error: membersCountError } = await supabase
        .from("room_members")
        .select("room_id, user_id")
        .in("room_id", roomIds)
        .eq("status", "accepted");

      const { data: participantsData, error: participantsCountError } = await supabase
        .from("room_participants")
        .select("room_id, user_id")
        .in("room_id", roomIds)
        .eq("status", "accepted");

      let countsMap = new Map<string, number>();
      if (membersCountError || participantsCountError) {
        console.error("[RoomContext] ❌ Error fetching member counts:", membersCountError || participantsCountError);
      } else {
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
      }

      const roomsWithMembership: RoomWithMembershipCount[] = allRooms.map((room) => ({
        ...room,
        memberCount: countsMap.get(room.id) ?? 0,
        isMember: (membershipMap.get(room.id) ?? null) === "accepted",
        participationStatus: membershipMap.get(room.id) ?? null,
      }));

      console.log("[RoomContext] ✅ Final rooms with membership:", roomsWithMembership.map(r => ({
        id: r.id,
        name: r.name,
        isMember: r.isMember,
        participationStatus: r.participationStatus,
        memberCount: r.memberCount
      })));

      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: roomsWithMembership });
    } catch (error) {
      console.error("[RoomContext] ❌ Error fetching rooms:", error);
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      toast.error("An error occurred while fetching rooms");
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [state.user, supabase]);

  const fetchAllUsers = useCallback(async () => {
    console.log("[RoomContext] 👥 Fetching all users:", {
      currentUserId: state.user?.id,
      currentUsername: state.user?.user_metadata?.username
    });

    if (!state.user) {
      console.log("[RoomContext] 🚫 No user - skipping user fetch");
      return [];
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, created_at");

      if (error) {
        console.error("[RoomContext] ❌ Error fetching profiles:", error);
        return [];
      }
      
      console.log("[RoomContext] ✅ Fetched users:", data?.map(u => ({
        id: u.id,
        username: u.username,
        display_name: u.display_name
      })));
      
      return data || [];
    } catch (error) {
      console.error("[RoomContext] ❌ Error fetching profiles:", error);
      return [];
    }
  }, [state.user, supabase]);

  const joinRoom = useCallback(
    async (roomId: string) => {
      console.log("[RoomContext] 🚀 Joining room:", {
        roomId,
        currentUserId: state.user?.id,
        currentUsername: state.user?.user_metadata?.username,
        currentDisplayName: state.user?.user_metadata?.display_name
      });

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
          console.log("[RoomContext] ❌ Join room failed:", data);
          dispatch({
            type: "UPDATE_ROOM_MEMBERSHIP",
            payload: { roomId, isMember: false, participationStatus: null },
          });
          throw new Error(data.error || "Failed to join room");
        }
        
        if (data.status === "accepted") {
          console.log("[RoomContext] ✅ Room join accepted:", {
            roomId,
            status: data.status,
            roomJoined: data.roomJoined
          });
          
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
        console.error("[RoomContext] ❌ Join room error:", error);
        toast.error(error.message || "Failed to join room");
        throw error;
      }
    },
    [state.user, dispatch]
  );

  const leaveRoom = useCallback(async (roomId: string) => {
    console.log("[RoomContext] 🚪 Leaving room:", {
      roomId,
      currentUserId: state.user?.id,
      currentUsername: state.user?.user_metadata?.username
    });

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

      console.log("[RoomContext] ✅ Successfully left room:", roomId);
      toast.success("Successfully left the room");
      dispatch({ type: "REMOVE_ROOM", payload: roomId });
      dispatch({ type: "UPDATE_ROOM_MEMBERSHIP", payload: { roomId, isMember: false, participationStatus: null } });
      if (state.selectedRoom?.id === roomId) {
        const remainingRooms = state.availableRooms.filter((room) => room.id !== roomId);
        dispatch({ type: "SET_SELECTED_ROOM", payload: remainingRooms[0] || null });
      }
    } catch (error) {
      console.error("[RoomContext] ❌ Leave room error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to leave room");
    } finally {
      dispatch({ type: "SET_IS_LEAVING", payload: false });
    }
  }, [state.user, supabase, state.selectedRoom, state.availableRooms]);

  const switchRoom = useCallback(async (newRoomId: string) => {
    console.log("[RoomContext] 🔄 Switching room:", {
      newRoomId,
      currentUserId: state.user?.id,
      currentUsername: state.user?.user_metadata?.username,
      currentSelectedRoom: state.selectedRoom?.id
    });

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
        console.log("[RoomContext] ✅ Room switched:", {
          from: state.selectedRoom?.id,
          to: newRoomId,
          roomName: switchedRoom.name
        });
        dispatch({ type: "SET_SELECTED_ROOM", payload: switchedRoom });
        toast.success(`Switched to ${switchedRoom.is_private ? "private" : "public"} room: ${switchedRoom.name}`);
      }
    } catch (err) {
      console.error("[RoomContext] ❌ Room switch failed:", err);
      toast.error("Failed to switch room");
    }
  }, [state.user, state.availableRooms, state.selectedRoom]);

  const createRoom = useCallback(async (name: string, isPrivate: boolean) => {
    console.log("[RoomContext] 🏗️ Creating room:", {
      name,
      isPrivate,
      currentUserId: state.user?.id,
      currentUsername: state.user?.user_metadata?.username
    });

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
      
      console.log("[RoomContext] ✅ Room created:", newRoomResponse);
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
      console.error("[RoomContext] ❌ Create room error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create room");
    }
  }, [state.user]);

  const setSelectedRoom = useCallback((room: RoomWithMembershipCount | null) => {
    console.log("[RoomContext] 🎯 Setting selected room:", {
      roomId: room?.id,
      roomName: room?.name,
      currentUserId: state.user?.id,
      currentUsername: state.user?.user_metadata?.username
    });
    dispatch({ type: "SET_SELECTED_ROOM", payload: room });
  }, [state.user]);

  const setSelectedDirectChat = useCallback((chat: DirectChat | null) => {
    console.log("[RoomContext] 🎯 Setting selected direct chat:", {
      chatId: chat?.id,
      currentUserId: state.user?.id,
      currentUsername: state.user?.user_metadata?.username
    });
    dispatch({ type: "SET_SELECTED_DIRECT_CHAT", payload: chat });
  }, [state.user]);

  const addMessage = useCallback((message: Imessage) => {
    console.log("[RoomContext] 💬 Message added:", {
      messageId: message.id,
      roomId: message.room_id,
      senderId: message.sender_id,
      currentUserId: state.user?.id
    });
  }, [state.user]);

  // Real-time subscriptions
  useEffect(() => {
    console.log("[RoomContext] 📡 Setting up real-time subscriptions:", {
      hasUser: !!state.user,
      selectedRoomId: state.selectedRoom?.id
    });

    if (!state.user) return;
    const channel = supabase.channel("room-changes-listener");

    channel
      .on(
        "postgres_changes" as any,
        { event: "INSERT,UPDATE,DELETE", schema: "public", table: "room_members", filter: `room_id=eq.${state.selectedRoom?.id || ""}` },
        (payload: RealtimePostgresChangesPayload<RoomMemberRow>) => {
          const room_id = (payload.new as RoomMemberRow | null)?.room_id ?? (payload.old as RoomMemberRow | null)?.room_id;
          console.log("[RoomContext] 📡 Room members change:", { payload, room_id });
          handleCountUpdate(room_id);
        }
      )
      .on(
        "postgres_changes" as any,
        { event: "INSERT,UPDATE,DELETE", schema: "public", table: "room_participants", filter: `room_id=eq.${state.selectedRoom?.id || ""}` },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const room_id = (payload.new as any)?.room_id ?? (payload.old as any)?.room_id;
          console.log("[RoomContext] 📡 Room participants change:", { payload, room_id });
          handleCountUpdate(room_id);
        }
      )
      .subscribe((status) => {
        console.log("[RoomContext] 📡 Real-time channel status:", status);
      });

    return () => {
      console.log("[RoomContext] 📡 Cleaning up real-time subscriptions");
      supabase.removeChannel(channel);
    };
  }, [supabase, state.user, state.selectedRoom?.id, handleCountUpdate]);

  useEffect(() => {
    console.log("[RoomContext] 🔄 Initial room fetch check:", {
      hasUser: !!state.user?.id,
      userId: state.user?.id
    });
    if (state.user?.id) fetchAvailableRooms();
  }, [state.user, fetchAvailableRooms]);

  // Log state changes
  useEffect(() => {
    console.log("[RoomContext] 📊 Current State:", {
      selectedRoom: state.selectedRoom ? {
        id: state.selectedRoom.id,
        name: state.selectedRoom.name,
        isMember: state.selectedRoom.isMember,
        participationStatus: state.selectedRoom.participationStatus,
        memberCount: state.selectedRoom.memberCount
      } : null,
      availableRooms: state.availableRooms.map(r => ({
        id: r.id,
        name: r.name,
        isMember: r.isMember,
        participationStatus: r.participationStatus
      })),
      user: state.user ? {
        id: state.user.id,
        email: state.user.email,
        username: state.user.user_metadata?.username,
        displayName: state.user.user_metadata?.display_name
      } : null,
      isLoading: state.isLoading,
      isMember: state.isMember
    });
  }, [state]);

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
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  const context = useContext(RoomContext);
  if (context === undefined) throw new Error("useRoomContext must be used within a RoomProvider");
  return context;
}