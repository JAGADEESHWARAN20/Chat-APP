// lib/store/RoomContext.tsx - REFACTORED & OPTIMIZED
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
import { User as SupabaseUser } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";
import { useMessage, Imessage } from "./messages";

// ==================== TYPES ====================
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type DirectChat = Database["public"]["Tables"]["direct_chats"]["Row"];

type PartialProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

type CachedProfile = {
  display_name?: string;
  username?: string;
};

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
    lastUpdated: string;
  };
};

// ==================== STATE ====================
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
  roomPresence: RoomPresence;
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
  | { type: "UPDATE_ROOM_MEMBERSHIP"; payload: { roomId: string; isMember: boolean; participationStatus: string | null } }
  | { type: "UPDATE_ROOM_MEMBER_COUNT"; payload: { roomId: string; memberCount: number } }
  | { type: "UPDATE_ROOM_ONLINE_USERS"; payload: { roomId: string; onlineUsers: number } }
  | { type: "UPDATE_ROOM_PRESENCE"; payload: { roomId: string; onlineUsers: number } }
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
  roomPresence: {},
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
            ? { ...room, isMember: action.payload.isMember, participationStatus: action.payload.participationStatus }
            : room
        ),
        selectedRoom:
          state.selectedRoom?.id === action.payload.roomId
            ? { ...state.selectedRoom, isMember: action.payload.isMember, participationStatus: action.payload.participationStatus }
            : state.selectedRoom ?? null,
      };
    case "UPDATE_ROOM_MEMBER_COUNT":
      return {
        ...state,
        availableRooms: state.availableRooms.map((room) =>
          room.id === action.payload.roomId ? { ...room, memberCount: action.payload.memberCount } : room
        ),
        selectedRoom:
          state.selectedRoom?.id === action.payload.roomId
            ? { ...state.selectedRoom, memberCount: action.payload.memberCount }
            : state.selectedRoom ?? null,
      };
    case "UPDATE_ROOM_ONLINE_USERS":
      return {
        ...state,
        availableRooms: state.availableRooms.map((room) =>
          room.id === action.payload.roomId ? { ...room, onlineUsers: action.payload.onlineUsers } : room
        ),
        selectedRoom:
          state.selectedRoom?.id === action.payload.roomId
            ? { ...state.selectedRoom, onlineUsers: action.payload.onlineUsers }
            : state.selectedRoom ?? null,
      };
    case "REMOVE_ROOM":
      return {
        ...state,
        availableRooms: state.availableRooms.filter((room) => room.id !== action.payload),
        selectedRoom: state.selectedRoom?.id === action.payload ? null : state.selectedRoom ?? null,
      };
    case "ADD_ROOM":
      return { ...state, availableRooms: [...state.availableRooms, action.payload] };
    case "UPDATE_ROOM_PRESENCE":
      return {
        ...state,
        roomPresence: {
          ...state.roomPresence,
          [action.payload.roomId]: { onlineUsers: action.payload.onlineUsers, lastUpdated: new Date().toISOString() },
        },
      };
    default:
      return state;
  }
}

// ==================== CONTEXT ====================
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
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

// ==================== PROVIDER ====================
export function RoomProvider({ children, user }: { children: React.ReactNode; user: SupabaseUser | undefined }) {
  const presenceChannelsRef = useRef<Map<string, any>>(new Map());
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

    profiles?.forEach((profile: any) => {
      profilesCache.current.set(profile.id, {
        display_name: profile.display_name || undefined,
        username: profile.username || undefined,
      });
    });
  }, [supabase]);

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

  useEffect(() => {
    const interval = setInterval(() => {
      if (profilesCache.current.size > 100) {
        profilesCache.current.clear();
      }
    }, 300000);

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
            .gt("updated_at", new Date(Date.now() - 5000).toISOString())
            .eq("is_typing", true);

          if (typingRecords.error) return;

          const typingUserIds = typingRecords.data.map((record) => record.user_id);
          await updateTypingUsersWithProfiles(typingUserIds);
        }
      )
      .subscribe();

    const interval = setInterval(async () => {
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
    const typingNames = state.typingUsers.map((user) => user.display_name || user.username || "User").filter(Boolean);

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
    if (memberStatus && memberStatus.length > 0 && memberStatus[0].status === "accepted")
      participationStatus = "accepted";
    else if (participantStatus && participantStatus.length > 0 && participantStatus[0].status === "accepted")
      participationStatus = "accepted";
    else if (memberStatus && memberStatus.length > 0 && memberStatus[0].status === "pending")
      participationStatus = "pending";
    else if (participantStatus && participantStatus.length > 0 && participantStatus[0].status === "pending")
      participationStatus = "pending";

    return participationStatus;
  }, [state.user, supabase]);

  const handleCountUpdate = useCallback(
    async (room_id: string | undefined) => {
      if (!room_id) return;

      try {
        // Count accepted members from both tables
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
          console.error(`Error updating room count for ${room_id}:`, membersError || participantsError);
          return;
        }

        const totalCount = (membersCount ?? 0) + (participantsCount ?? 0);

        dispatch({
          type: "UPDATE_ROOM_MEMBER_COUNT",
          payload: { roomId: room_id, memberCount: totalCount },
        });
      } catch (error) {
        console.error("Error updating room count:", error);
      }
    },
    [supabase]
  );

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

      // Get current user's membership status
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

      // Count ACCEPTED members from both tables (UNION ALL approach)
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
        console.error("Error counting members/participants:", membersError || participantsError);
      }

      // Create a map to count ACCEPTED members per room
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
      const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url, created_at");
      return data || [];
    } catch (error) {
      console.error("[RoomContext] Error fetching profiles:", error);
      return [];
    }
  }, [state.user, supabase]);

  const joinRoom = useCallback(
    async (roomId: string) => {
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
    },
    [dispatch]
  );

  const leaveRoom = useCallback(
    async (roomId: string) => {
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
        if (membersError || participantsError)
          throw new Error(membersError?.message || participantsError?.message || "Failed to leave room");

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
    },
    [state.user, supabase, state.selectedRoom, state.availableRooms, dispatch]
  );

  const switchRoom = useCallback(
    async (newRoomId: string) => {
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
    },
    [state.user, state.availableRooms, dispatch]
  );

  const createRoom = useCallback(
    async (name: string, isPrivate: boolean) => {
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
    },
    [state.user, dispatch]
  );

  const setSelectedRoom = useCallback((room: RoomWithMembershipCount | null) => {
    dispatch({ type: "SET_SELECTED_ROOM", payload: room });
  }, [dispatch]);

  const setSelectedDirectChat = useCallback((chat: DirectChat | null) => {
    dispatch({ type: "SET_SELECTED_DIRECT_CHAT", payload: chat });
  }, [dispatch]);

  const { addMessage: addMessageToStore, messages } = useMessage();

  const addMessage = useCallback(
    (message: Imessage) => {
      if (!messages.some((m) => m.id === message.id)) {
        addMessageToStore(message);
      }
    },
    [messages, addMessageToStore]
  );

  // Auto-fetch rooms when user changes
  useEffect(() => {
    if (state.user?.id) fetchAvailableRooms();
  }, [state.user, fetchAvailableRooms]);

  // Subscribe to changes on room_members and room_participants
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

  // Optimized presence tracking for all member rooms
  const trackAllRoomsPresence = useCallback(async () => {
    if (!state.user?.id || state.availableRooms.length === 0) return;

    const memberRooms = state.availableRooms.filter((room) => room.isMember);

    memberRooms.forEach(async (room) => {
      if (presenceChannelsRef.current.has(room.id)) return;

      const channel = supabase.channel(`presence:${room.id}`);

      // Unified presence handler
      const handlePresenceUpdate = () => {
        try {
          const presenceState = channel.presenceState();
          const onlineUsers = new Set<string>();

          Object.values(presenceState).forEach((presences: any) => {
            if (Array.isArray(presences)) {
              presences.forEach((presence: any) => {
                if (presence?.user_id) onlineUsers.add(presence.user_id);
              });
            }
          });

          const onlineCount = onlineUsers.size;
          
          // Dispatch both updates atomically
          dispatch({ type: "UPDATE_ROOM_PRESENCE", payload: { roomId: room.id, onlineUsers: onlineCount } });
          dispatch({ type: "UPDATE_ROOM_ONLINE_USERS", payload: { roomId: room.id, onlineUsers: onlineCount } });
        } catch (err) {
          console.error(`[RoomProvider] Error updating presence for room ${room.id}:`, err);
        }
      };

      channel
        .on("presence", { event: "sync" }, handlePresenceUpdate)
        .on("presence", { event: "join" }, handlePresenceUpdate)
        .on("presence", { event: "leave" }, handlePresenceUpdate)
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            try {
              await channel.track({
                user_id: state.user?.id,
                room_id: room.id,
                online_at: new Date().toISOString(),
              });
            } catch (err) {
              console.error(`[RoomProvider] Error tracking presence for room ${room.id}:`, err);
            }
          }
        });

      presenceChannelsRef.current.set(room.id, channel);
    });
  }, [state.user?.id, state.availableRooms, supabase, dispatch]);

  useEffect(() => {
    if (state.user?.id && state.availableRooms.length > 0) {
      trackAllRoomsPresence();
    }

    return () => {
      presenceChannelsRef.current.forEach((channel, roomId) => {
        try {
          channel.unsubscribe();
          supabase.removeChannel(channel);
        } catch (err) {
          console.warn(`[RoomProvider] Error cleaning up presence channel for room ${roomId}:`, err);
        }
      });
      presenceChannelsRef.current.clear();
    };
  }, [state.user?.id, state.availableRooms, trackAllRoomsPresence, supabase]);

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
    updateTypingUsers,
    updateTypingText,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  const context = useContext(RoomContext);
  if (context === undefined) throw new Error("useRoomContext must be used within a RoomProvider");
  return context;
}
