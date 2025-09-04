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

export type RoomWithMembershipCount = Room & {
  isMember: boolean;
  participationStatus: string | null;
  memberCount: number;
};

// ---- State ----
interface RoomState {
  availableRooms: RoomWithMembershipCount[];
  selectedRoom: RoomWithMembershipCount | null;
  selectedDirectChat: DirectChat | null; // ✅ add direct chat
  isLoading: boolean;
  isMember: boolean;
  isLeaving: boolean;
}

type RoomAction =
  | { type: "SET_AVAILABLE_ROOMS"; payload: RoomWithMembershipCount[] }
  | { type: "SET_SELECTED_ROOM"; payload: RoomWithMembershipCount | null }
  | { type: "SET_SELECTED_DIRECT_CHAT"; payload: DirectChat | null } // ✅ handle direct chat
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_IS_MEMBER"; payload: boolean }
  | { type: "SET_IS_LEAVING"; payload: boolean }
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
  selectedDirectChat: null, // ✅ initialize
  isLoading: false,
  isMember: false,
  isLeaving: false,
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
    case "REMOVE_ROOM":
      return {
        ...state,
        availableRooms: state.availableRooms.filter(
          (room) => room.id !== action.payload
        ),
        selectedRoom:
          state.selectedRoom?.id === action.payload ? null : state.selectedRoom,
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
  addMessage: (message: Imessage) => void;   // ✅ add this
  // Inside RoomContextType
acceptJoinNotification: (roomId: string) => Promise<void>;

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
const acceptJoinNotification = useCallback(
  async (roomId: string) => {
    try {
      const { data: room } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();

      if (!room) throw new Error("Room not found after acceptance");

      const roomWithMembership: RoomWithMembershipCount = {
        ...room,
        isMember: true,
        participationStatus: "accepted",
        memberCount: 0, // will be updated by realtime
      };

      dispatch({ type: "ADD_ROOM", payload: roomWithMembership });
      dispatch({ type: "SET_SELECTED_ROOM", payload: roomWithMembership });

      toast.success(`Accepted join request for room: ${room.name}`);
    } catch (err) {
      console.error("Error in acceptJoinNotification:", err);
      toast.error("Failed to update room after acceptance");
    }
  },
  [supabase]
);


  const checkRoomMembership = useCallback(
    async (roomId: string) => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .eq("status", "accepted");
      if (error) {
        console.error("Error checking room membership:", error);
        return false;
      }
      return data && data.length > 0 && data[0].status === "accepted";
    },
    [user, supabase]
  );

  const checkRoomParticipation = useCallback(
    async (roomId: string) => {
      if (!user) return null;
      const { data: memberStatus, error: memberError } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", user.id);
      if (memberError) console.error("Error checking room membership for participation status:", memberError);

      const { data: participantStatus, error: participantError } = await supabase
        .from("room_participants")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", user.id);
      if (participantError) console.error("Error checking room participation status:", participantError);

      if (memberStatus && memberStatus.length > 0 && memberStatus[0].status === "accepted") return "accepted";
      if (participantStatus && participantStatus.length > 0 && participantStatus[0].status === "accepted") return "accepted";
      if (memberStatus && memberStatus.length > 0 && memberStatus[0].status === "pending") return "pending";
      if (participantStatus && participantStatus.length > 0 && participantStatus[0].status === "pending") return "pending";
      return null;
    },
    [user, supabase]
  );

// RoomContext.tsx (in fetchAvailableRooms)
const fetchAvailableRooms = useCallback(async () => {
  if (!user) {
    dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
    dispatch({ type: "SET_LOADING", payload: false });
    return;
  }

  dispatch({ type: "SET_LOADING", payload: true });
  try {
    const { data: memberships, error: membersError } = await supabase
      .from("room_members")
      .select("room_id, rooms(id, name, is_private, created_by, created_at), status")
      .eq("user_id", user.id)
      .eq("status", "accepted");

    const { data: participants, error: participantsError } = await supabase
      .from("room_participants")
      .select("room_id, rooms(id, name, is_private, created_by, created_at), status")
      .eq("user_id", user.id)
      .eq("status", "accepted");

    if (membersError || participantsError) {
      console.error("Error fetching rooms:", membersError || participantsError);
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    console.log("Fetched memberships:", memberships); // Debug log
    console.log("Fetched participants:", participants); // Debug log

    const joinedRoomsRaw = [
      ...(memberships || []).map((m) => ({ ...m.rooms, status: m.status! })),
      ...(participants || []).map((p) => ({ ...p.rooms, status: p.status! })),
    ].reduce((acc, room) => {
      if (!acc.find((r) => r.id === room.id)) acc.push(room);
      return acc;
    }, [] as (Room & { status: string })[]);

    const roomIds = joinedRoomsRaw.map((r) => r.id);
    let countsMap = new Map<string, number>();

    if (roomIds.length > 0) {
      const { data: membersData, error: membersError } = await supabase
        .from("room_members")
        .select("room_id, user_id")
        .in("room_id", roomIds)
        .eq("status", "accepted");
      const { data: participantsData, error: participantsError } = await supabase
        .from("room_participants")
        .select("room_id, user_id")
        .in("room_id", roomIds)
        .eq("status", "accepted");

      if (membersError || participantsError) {
        console.error("Error fetching member counts:", membersError || participantsError);
      }

      const uniqueUsers = new Map<string, Set<string>>();
      membersData?.forEach((m: { room_id: string; user_id: string }) => {
        if (!uniqueUsers.has(m.room_id)) uniqueUsers.set(m.room_id, new Set());
        uniqueUsers.get(m.room_id)!.add(m.user_id);
      });
      participantsData?.forEach((p: { room_id: string; user_id: string }) => {
        if (!uniqueUsers.has(p.room_id)) uniqueUsers.set(p.room_id, new Set());
        uniqueUsers.get(p.room_id)!.add(p.user_id);
      });

      countsMap = new Map([...uniqueUsers].map(([roomId, users]) => [roomId, users.size]));
    }

    const joinedRooms: RoomWithMembershipCount[] = joinedRoomsRaw.map((room) => ({
      ...room,
      memberCount: countsMap.get(room.id) ?? 0,
      isMember: room.status === "accepted",
      participationStatus: room.status,
    }));

    dispatch({ type: "SET_AVAILABLE_ROOMS", payload: joinedRooms });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
    toast.error("An error occurred while fetching rooms");
  } finally {
    dispatch({ type: "SET_LOADING", payload: false });
  }
}, [user, supabase]);


  // RoomProvider.tsx
const joinRoom = useCallback(
  async (roomId: string) => {
    if (!user) {
      toast.error("You must be logged in to join a room");
      return;
    }
    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to join room");
      }

      // Check the status returned by the server
      if (result.status === "pending") {
        toast.success(result.message || "Join request sent.");
        // We do not add the room to availableRooms since the user is not a member yet.
        // The user will see this in the search results with a 'Pending' status.
      } else { // status === "accepted"
        const roomJoined = result.roomJoined; // Get the room data from the back-end response
        if (!roomJoined) throw new Error("Missing room data from API response.");

        // Dispatch the actions to update state with the new room
        dispatch({
          type: "SET_SELECTED_ROOM",
          payload: {
            ...roomJoined,
            isMember: true,
            participationStatus: "accepted",
            memberCount: 0, // A separate fetch or a better API response could provide this
          },
        });
        dispatch({
          type: "ADD_ROOM",
          payload: {
            ...roomJoined,
            isMember: true,
            participationStatus: "accepted",
            memberCount: 0,
          },
        });
        toast.success(result.message || "Joined room successfully!");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join room");
    }
  },
  [user]
);

  const leaveRoom = useCallback(async (roomId: string) => {
    if (!user) {
      toast.error("Please log in to leave a room");
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
      if (membersError || participantsError) throw new Error(membersError?.message || participantsError?.message || "Failed to leave room");

      toast.success("Successfully left the room");
      dispatch({ type: "REMOVE_ROOM", payload: roomId });
      dispatch({ type: "UPDATE_ROOM_MEMBERSHIP", payload: { roomId, isMember: false, participationStatus: null } });
      if (state.selectedRoom?.id === roomId) {
        const remainingRooms = state.availableRooms.filter((room) => room.id !== roomId);
        dispatch({ type: "SET_SELECTED_ROOM", payload: remainingRooms[0] || null });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to leave room");
    } finally {
      dispatch({ type: "SET_IS_LEAVING", payload: false });
    }
  }, [user, supabase, state.selectedRoom, state.availableRooms]);

  const switchRoom = useCallback(async (newRoomId: string) => {
    if (!user) {
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
        toast.success(`
Switched to ${switchedRoom.is_private ? "private" : "public"} room: ${switchedRoom.name}`);
      }
    } catch (err) {
      console.error("Room switch failed:", err);
      toast.error("Failed to switch room");
    }
  }, [user, state.availableRooms]);

  const createRoom = useCallback(async (name: string, isPrivate: boolean) => {
    if (!user) {
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
      toast.error(error instanceof Error ? error.message : "Failed to create room");
    }
  }, [user]);

  const setSelectedRoom = useCallback((room: RoomWithMembershipCount | null) => {
    dispatch({ type: "SET_SELECTED_ROOM", payload: room });
  }, []);
  // Add this above const value
const setSelectedDirectChat = useCallback((chat: DirectChat | null) => {
  dispatch({ type: "SET_SELECTED_DIRECT_CHAT", payload: chat });
}, []);

const addMessage = useCallback((message: Imessage) => {
  console.log("Message added (RoomContext):", message);
  // later you can sync with Zustand if needed
}, []);


  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("room-members-listener")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members" },
        async (payload: RealtimePostgresChangesPayload<RoomMemberRow>) => {
          const room_id = (payload.new as RoomMemberRow | null)?.room_id ?? (payload.old as RoomMemberRow | null)?.room_id;
          if (!room_id) return;
          const { count: totalCount } = await supabase
            .from("room_members")
            .select("*", { count: "exact", head: true })
            .eq("room_id", room_id)
            .eq("status", "accepted");
          dispatch({ type: "UPDATE_ROOM_MEMBER_COUNT", payload: { roomId: room_id, memberCount: totalCount ?? 0 } });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user]);

  useEffect(() => {
    if (user?.id) fetchAvailableRooms();
  }, [user, fetchAvailableRooms]);

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
  addMessage, // ✅ expose
  acceptJoinNotification, // ✅ expose
};


  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  const context = useContext(RoomContext);
  if (context === undefined) throw new Error("useRoomContext must be used within a RoomProvider");
  return context;
}