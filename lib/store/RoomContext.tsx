"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { User as SupabaseUser, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomMemberRow = Database["public"]["Tables"]["room_members"]["Row"];

// Extended Room type including memberCount, isMember, participationStatus
export type RoomWithMembershipCount = Room & {
  isMember: boolean;
  participationStatus: string | null;
  memberCount: number;
};

// State interface
interface RoomState {
  availableRooms: RoomWithMembershipCount[];
  selectedRoom: RoomWithMembershipCount | null;
  isLoading: boolean;
  isMember: boolean;
  isLeaving: boolean;
}

// Action types
type RoomAction =
  | { type: "SET_AVAILABLE_ROOMS"; payload: RoomWithMembershipCount[] }
  | { type: "SET_SELECTED_ROOM"; payload: RoomWithMembershipCount | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_IS_MEMBER"; payload: boolean }
  | { type: "SET_IS_LEAVING"; payload: boolean }
  | { type: "UPDATE_ROOM_MEMBERSHIP"; payload: { roomId: string; isMember: boolean; participationStatus: string | null } }
  | { type: "UPDATE_ROOM_MEMBER_COUNT"; payload: { roomId: string; memberCount: number } }
  | { type: "REMOVE_ROOM"; payload: string }
  | { type: "ADD_ROOM"; payload: RoomWithMembershipCount };

// Initial state
const initialState: RoomState = {
  availableRooms: [],
  selectedRoom: null,
  isLoading: false,
  isMember: false,
  isLeaving: false,
};

// Reducer function
function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case "SET_AVAILABLE_ROOMS":
      return { ...state, availableRooms: action.payload };
    
    case "SET_SELECTED_ROOM":
      return { ...state, selectedRoom: action.payload };
    
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    
    case "SET_IS_MEMBER":
      return { ...state, isMember: action.payload };
    
    case "SET_IS_LEAVING":
      return { ...state, isLeaving: action.payload };
    
    case "UPDATE_ROOM_MEMBERSHIP":
      return {
        ...state,
        availableRooms: state.availableRooms.map(room =>
          room.id === action.payload.roomId
            ? { ...room, isMember: action.payload.isMember, participationStatus: action.payload.participationStatus }
            : room
        ),
        selectedRoom: state.selectedRoom?.id === action.payload.roomId
          ? { ...state.selectedRoom, isMember: action.payload.isMember, participationStatus: action.payload.participationStatus }
          : state.selectedRoom
      };
    
    case "UPDATE_ROOM_MEMBER_COUNT":
      return {
        ...state,
        availableRooms: state.availableRooms.map(room =>
          room.id === action.payload.roomId
            ? { ...room, memberCount: action.payload.memberCount }
            : room
        ),
        selectedRoom: state.selectedRoom?.id === action.payload.roomId
          ? { ...state.selectedRoom, memberCount: action.payload.memberCount }
          : state.selectedRoom
      };
    
    case "REMOVE_ROOM":
      return {
        ...state,
        availableRooms: state.availableRooms.filter(room => room.id !== action.payload),
        selectedRoom: state.selectedRoom?.id === action.payload ? null : state.selectedRoom
      };
    
    case "ADD_ROOM":
      return {
        ...state,
        availableRooms: [...state.availableRooms, action.payload]
      };
    
    default:
      return state;
  }
}

// Context interface
interface RoomContextType {
  state: RoomState;
  fetchAvailableRooms: () => Promise<void>;
  setSelectedRoom: (room: RoomWithMembershipCount | null) => void;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  switchRoom: (newRoomId: string) => Promise<void>;
  createRoom: (name: string, isPrivate: boolean) => Promise<void>;
  checkRoomMembership: (roomId: string) => Promise<boolean>;
  checkRoomParticipation: (roomId: string) => Promise<string | null>;
}

// Create context
const RoomContext = createContext<RoomContextType | undefined>(undefined);

// Provider component
export function RoomProvider({ children, user }: { children: React.ReactNode; user: SupabaseUser | undefined }) {
  const [state, dispatch] = useReducer(roomReducer, initialState);
  const supabase = supabaseBrowser();

  // Check if current user is a member of given room
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

  // Check participation status for a given room
  const checkRoomParticipation = useCallback(
    async (roomId: string) => {
      if (!user) return null;
      const { data: memberStatus, error: memberError } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (memberError) {
        console.error("Error checking room membership for participation status:", memberError);
      }

      const { data: participantStatus, error: participantError } =
        await supabase
          .from("room_participants")
          .select("status")
          .eq("room_id", roomId)
          .eq("user_id", user.id);

      if (participantError) {
        console.error("Error checking room participation status:", participantError);
      }

      if (
        memberStatus &&
        memberStatus.length > 0 &&
        memberStatus[0].status === "accepted"
      ) {
        return "accepted";
      }
      if (
        participantStatus &&
        participantStatus.length > 0 &&
        participantStatus[0].status === "accepted"
      ) {
        return "accepted";
      }
      if (
        memberStatus &&
        memberStatus.length > 0 &&
        memberStatus[0].status === "pending"
      ) {
        return "pending";
      }
      if (
        participantStatus &&
        participantStatus.length > 0 &&
        participantStatus[0].status === "pending"
      ) {
        return "pending";
      }
      return null;
    },
    [user, supabase]
  );

  // Fetch all available rooms where user is a member
  const fetchAvailableRooms = useCallback(async () => {
    if (!user) {
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    try {
      // Fetch accepted memberships for user + associated rooms
      const { data: memberships, error } = await supabase
        .from("room_members")
        .select("room_id, rooms(id, name, is_private, created_by, created_at)")
        .eq("user_id", user.id)
        .eq("status", "accepted");

      if (error) {
        dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
        dispatch({ type: "SET_LOADING", payload: false });
        return;
      }

      const joinedRoomsRaw = (memberships || [])
        .map((m) => m.rooms as Room)
        .filter(Boolean);

      // Collect room IDs for count query
      const roomIds = joinedRoomsRaw.map((r) => r.id);
      let countsMap = new Map<string, number>();

      if (roomIds.length > 0) {
        const { data: membersData, error: membersError } = await supabase
          .from("room_members")
          .select("room_id")
          .in("room_id", roomIds)
          .eq("status", "accepted");

        if (membersError) {
          console.error("Error fetching member counts:", membersError);
        }

        // Aggregate counts client-side
        membersData?.forEach((m: Pick<RoomMemberRow, "room_id">) => {
          countsMap.set(m.room_id, (countsMap.get(m.room_id) ?? 0) + 1);
        });
      }

      // Attach memberCount, isMember:true, participationStatus to each room
      const joinedRooms: RoomWithMembershipCount[] = joinedRoomsRaw.map((room) => ({
        ...room,
        memberCount: countsMap.get(room.id) ?? 0,
        isMember: true,
        participationStatus: "accepted",
      }));

      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: joinedRooms });
    } catch (error) {
      dispatch({ type: "SET_AVAILABLE_ROOMS", payload: [] });
      toast.error("An error occurred while fetching rooms");
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [user, supabase]);

  // Join room
  const joinRoom = useCallback(async (roomId: string) => {
    if (!user) {
      toast.error("You must be logged in to join a room");
      return;
    }

    try {
      const response = await fetch(`/api/rooms/switch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roomId }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.code === "AUTH_REQUIRED") {
          toast.error("Authentication required to join rooms.");
        } else if (result.code === "ROOM_NOT_FOUND") {
          toast.error("Room not found.");
        } else if (result.status === "pending") {
          toast.info(result.message || "Join request sent to room owner for approval.");
        } else {
          toast.error(result.message || "Failed to join room.");
        }
        return;
      }

      let newParticipationStatus: string | null = "accepted";
      let newIsMember = true;

      if (result.status === "pending") {
        newParticipationStatus = "pending";
        newIsMember = false;
      }

      const { data: room } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();

      if (!room) {
        throw new Error("Failed to fetch room details after join.");
      }

      const roomWithMembership: RoomWithMembershipCount = {
        ...room,
        isMember: newIsMember,
        participationStatus: newParticipationStatus,
        memberCount: 0,
      };

      dispatch({ type: "SET_SELECTED_ROOM", payload: roomWithMembership });
      dispatch({ type: "ADD_ROOM", payload: roomWithMembership });
      
      toast.success(result.message || "Joined room successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join room");
    }
  }, [user, supabase]);

  // Leave room
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

      if (membersError || participantsError) {
        throw new Error(
          membersError?.message || participantsError?.message || "Failed to leave room"
        );
      }

      toast.success("Successfully left the room");
      dispatch({ type: "REMOVE_ROOM", payload: roomId });
      dispatch({ type: "UPDATE_ROOM_MEMBERSHIP", payload: { roomId, isMember: false, participationStatus: null } });

      // If this was the selected room, switch to another room or go home
      if (state.selectedRoom?.id === roomId) {
        const remainingRooms = state.availableRooms.filter(room => room.id !== roomId);
        if (remainingRooms.length > 0) {
          const defaultRoom = remainingRooms.find((room) => room.name === "General Chat") || remainingRooms[0];
          dispatch({ type: "SET_SELECTED_ROOM", payload: defaultRoom });
        } else {
          dispatch({ type: "SET_SELECTED_ROOM", payload: null });
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to leave room");
    } finally {
      dispatch({ type: "SET_IS_LEAVING", payload: false });
    }
  }, [user, supabase, state.selectedRoom, state.availableRooms]);

  // Switch room
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
      if (!response.ok) {
        toast.error(result.message || "Failed to switch room");
        return;
      }

      const switchedRoom = state.availableRooms.find((r) => r.id === newRoomId);
      if (switchedRoom) {
        dispatch({ type: "SET_SELECTED_ROOM", payload: switchedRoom });
        toast.success(`Switched to ${switchedRoom.name}`);
      }
    } catch (err) {
      console.error("Room switch failed:", err);
      toast.error("Failed to switch room");
    }
  }, [user, state.availableRooms]);

  // Create room
  const createRoom = useCallback(async (name: string, isPrivate: boolean) => {
    if (!user) {
      toast.error("You must be logged in to create a room");
      return;
    }

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: name.trim(), isPrivate }),
      });

      const newRoomResponse = await response.json();

      if (!response.ok) {
        throw new Error(newRoomResponse.error || "Failed to create room");
      }

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

  // Set selected room
  const setSelectedRoom = useCallback((room: RoomWithMembershipCount | null) => {
    dispatch({ type: "SET_SELECTED_ROOM", payload: room });
  }, []);

  // Real-time subscription for room membership changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("room-members-listener")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members" },
        async (payload: RealtimePostgresChangesPayload<RoomMemberRow>) => {
          const room_id =
            (payload.new as RoomMemberRow | null)?.room_id ??
            (payload.old as RoomMemberRow | null)?.room_id;

          if (!room_id) return;

          // Recalculate memberCount for this room
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
      channel.unsubscribe();
    };
  }, [supabase, user]);

  // Initial fetch
  useEffect(() => {
    if (user?.id) {
      fetchAvailableRooms();
    }
  }, [user, fetchAvailableRooms]);

  const value: RoomContextType = {
    state,
    fetchAvailableRooms,
    setSelectedRoom,
    joinRoom,
    leaveRoom,
    switchRoom,
    createRoom,
    checkRoomMembership,
    checkRoomParticipation,
  };

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
}

// Hook to use the context
export function useRoomContext() {
  const context = useContext(RoomContext);
  if (context === undefined) {
    throw new Error("useRoomContext must be used within a RoomProvider");
  }
  return context;
}
