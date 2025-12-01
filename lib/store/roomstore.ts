"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/sonner";
import type { Database } from "@/lib/types/supabase";

/* -------------------------------------------------------
   TYPES - Using your Database types
------------------------------------------------------- */

type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
type RoomMembersRow = Database["public"]["Tables"]["room_members"]["Row"];
type RoomParticipantsRow = Database["public"]["Tables"]["room_participants"]["Row"];

export type RoomWithMembership = RoomRow & {
  created_by?: string | null;
  isMember: boolean;
  participationStatus: "pending" | "accepted" | null;
  memberCount: number;
  online_users?: number;
  unreadCount?: number;
  latestMessage?: string | null;
  latest_message_created_at?: string | null;
};

export interface RoomPresence {
  onlineUsers: number;
  userIds: string[];
  lastUpdated?: string;
}

export interface TypingUser {
  user_id: string;
  is_typing: boolean;
  display_name?: string;
}

interface RoomState {
  // Auth / identity
  user: { id: string } | null;

  // Rooms & presence
  rooms: RoomWithMembership[];
  selectedRoomId: string | null;
  roomPresence: Record<string, RoomPresence>;

  // UI / status
  isLoading: boolean;
  error: string | null;

  // Typing state (for useTypingStatus / TypingIndicator)
  typingUsers: TypingUser[];
  typingDisplayText: string;

  // Setters
  setUser: (u: { id: string } | null) => void;
  setRooms: (rooms: RoomWithMembership[]) => void;
  setSelectedRoomId: (id: string | null) => void;
  setRoomPresence: (roomId: string, presence: RoomPresence) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  clearError: () => void;

  // Typing setters
  updateTypingUsers: (users: TypingUser[]) => void;
  updateTypingText: (text: string) => void;

  // Core operations
  fetchRooms: (opts?: { force?: boolean }) => Promise<RoomWithMembership[] | null>;
  joinRoom: (roomId: string) => Promise<boolean>;
  leaveRoom: (roomId: string) => Promise<boolean>;
  createRoom: (name: string, isPrivate: boolean) => Promise<RoomWithMembership | null>;
  sendMessage: (roomId: string, text: string) => Promise<boolean>;

  // Instant sync operations
  updateRoomMembership: (roomId: string, updates: Partial<RoomWithMembership>) => void;
  refreshRooms: () => Promise<void>;
  forceRefreshRooms: () => void;
}

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

const normalizeRpcRooms = (rows: any[]): RoomWithMembership[] =>
  rows.map((r) => ({
    id: r.id,
    name: r.name,
    is_private: r.is_private,
    created_by: r.created_by,
    created_at: r.created_at,
    memberCount: r.member_count ?? 0,
    latestMessage: r.latest_message ?? null,
    latest_message_created_at: r.latest_message_created_at ?? null,
    isMember: Boolean(r.is_member),
    participationStatus: r.participation_status ?? null,
    unreadCount: r.unread_count ?? 0,
    online_users: r.online_users ?? 0,
  }));

const safeJson = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

/* -------------------------------------------------------
   STORE
------------------------------------------------------- */

export const useUnifiedRoomStore = create<RoomState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Base state
      user: null,
      rooms: [],
      selectedRoomId: null,
      roomPresence: {},
      isLoading: false,
      error: null,

      // Typing state
      typingUsers: [],
      typingDisplayText: "",

      /* ------------------------------
         SETTERS
      ------------------------------ */

      setUser: (u) => {
        set({ user: u });
      },

      setRooms: (rooms) => {
        set({ rooms });

        const sel = get().selectedRoomId;
        if (!sel && rooms.length > 0) {
          const defaultRoom =
            rooms.find((r) => r.name === "General Chat") ?? rooms[0];
          set({ selectedRoomId: defaultRoom?.id ?? null });
        }
      },

      setSelectedRoomId: (id) => {
        set({ selectedRoomId: id });
      
        // Reset unread count when you open the room
        if (id) {
          set((state) => ({
            rooms: state.rooms.map((room) =>
              room.id === id ? { ...room, unreadCount: 0 } : room
            ),
          }));
        }
      },
      

      setRoomPresence: (roomId, presence) =>
        set((state) => ({
          roomPresence: { ...state.roomPresence, [roomId]: presence },
        })),

      setLoading: (v) => set({ isLoading: v }),

      setError: (v) => set({ error: v }),

      clearError: () => set({ error: null }),

      // Typing setters
      updateTypingUsers: (users) => set({ typingUsers: users }),
      updateTypingText: (text) => set({ typingDisplayText: text }),

      /* ------------------------------
         INSTANT OPTIMISTIC UPDATES
      ------------------------------ */

      updateRoomMembership: (roomId, updates) => {
        set((state) => ({
          rooms: state.rooms.map((room) =>
            room.id === roomId ? { ...room, ...updates } : room
          ),
        }));
      },

      refreshRooms: async (): Promise<void> => {
        await get().fetchRooms({ force: true });
      },

      forceRefreshRooms: () => {
        get().fetchRooms({ force: true });
      },
      

      /* ------------------------------
         CORE OPERATIONS
      ------------------------------ */

      fetchRooms: async ({ force = false } = {}) => {
        const supabase = getSupabaseBrowserClient();
        const userId = get().user?.id;
      
        if (!userId) return null;
      
        try {
          set({ isLoading: true, error: null });
      
          const { data, error } = await supabase.rpc("get_rooms_with_counts", {
            p_user_id: userId,
            p_query: null as any,
          });
      
          if (error) {
            console.error("❌ fetchRooms RPC error:", error);
            set({ error: error.message ?? "Failed to fetch rooms" });
            return null;
          }
      
          const formatted = normalizeRpcRooms(data);
      
          // Only update Zustand if data changed → reduces renders
          set((state) => {
            const changed = JSON.stringify(state.rooms) !== JSON.stringify(formatted);
            return changed ? { rooms: formatted } : state;
          });
      
          // Maintain selected room
          const sel = get().selectedRoomId;
          if (!sel && formatted.length > 0) {
            const defaultRoom =
              formatted.find((r) => r.name === "General Chat") ?? formatted[0];
            set({ selectedRoomId: defaultRoom.id });
          }
      
          return formatted;
        } catch (err: any) {
          console.error("❌ fetchRooms error:", err);
          set({ error: err.message ?? "Failed to fetch rooms" });
          return null;
        } finally {
          set({ isLoading: false });
        }
      },
      
      sendMessage: async (roomId: string, text: string) => {
        try {
          const res = await fetch("/api/messages/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId, text }),
          });
          return res.ok;
        } catch (err) {
          console.error("❌ sendMessage error:", err);
          return false;
        }
      },

      joinRoom: async (roomId) => {
        const room = get().rooms.find((r) => r.id === roomId);
        const currentUserId = get().user?.id;
        const isOwner =
          room?.created_by && currentUserId
            ? room.created_by === currentUserId
            : false;

        // Optimistic update
        if (room?.is_private && !isOwner) {
          get().updateRoomMembership(roomId, { participationStatus: "pending" });
          toast.info("Join request sent — awaiting approval");
        } else if (room) {
          get().updateRoomMembership(roomId, {
            isMember: true,
            participationStatus: "accepted",
            memberCount: (room.memberCount || 0) + 1,
          });
          toast.success("Joined room successfully!");
        }

        try {
          const res = await fetch(`/api/rooms/${roomId}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          const json = await safeJson(res);

          if (!res.ok) {
            // rollback
            if (room) {
              get().updateRoomMembership(roomId, {
                isMember: room.isMember,
                participationStatus: room.participationStatus,
                memberCount: room.memberCount,
              });
            }
            toast.error(json?.error || "Failed to join room");
            return false;
          }

          setTimeout(() => get().refreshRooms(), 500);
          return true;
        } catch (err: any) {
          console.error("❌ joinRoom error:", err);
          if (room) {
            get().updateRoomMembership(roomId, {
              isMember: room.isMember,
              participationStatus: room.participationStatus,
              memberCount: room.memberCount,
            });
          }
          toast.error("Failed to join room");
          return false;
        }
      },

      leaveRoom: async (roomId) => {
        const room = get().rooms.find((r) => r.id === roomId);

        // Optimistic update
        if (room) {
          get().updateRoomMembership(roomId, {
            isMember: false,
            participationStatus: null,
            memberCount: Math.max(0, (room.memberCount || 0) - 1),
          });
          if (get().selectedRoomId === roomId) {
            set({ selectedRoomId: null });
          }
          toast.success("Left room successfully");
        }

        try {
          const res = await fetch(`/api/rooms/${roomId}/leave`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
          });
          const json = await safeJson(res);

          if (!res.ok) {
            // rollback
            if (room) {
              get().updateRoomMembership(roomId, {
                isMember: room.isMember,
                participationStatus: room.participationStatus,
                memberCount: room.memberCount,
              });
            }
            toast.error(json?.error || "Failed to leave room");
            return false;
          }

          setTimeout(() => get().refreshRooms(), 1000);
          return true;
        } catch (err: any) {
          console.error("❌ leaveRoom error:", err);
          if (room) {
            get().updateRoomMembership(roomId, {
              isMember: room.isMember,
              participationStatus: room.participationStatus,
              memberCount: room.memberCount,
            });
          }
          toast.error("Failed to leave room");
          return false;
        }
      },

      createRoom: async (name, isPrivate) => {
        try {
          const res = await fetch("/api/rooms/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, isPrivate }),
          });
          const json = await safeJson(res);

          if (!res.ok) {
            toast.error(json?.error || "Failed to create room");
            return null;
          }

          await get().refreshRooms();
          const created =
            get().rooms.find((r) => r.name === name) ?? null;

          if (created) {
            toast.success("Room created");
            return created;
          }
          return null;
        } catch (err: any) {
          console.error("❌ createRoom error:", err);
          toast.error("Failed to create room");
          return null;
        }
      },
    }))
  )
);

/* -------------------------------------------------------
   SELECTORS
------------------------------------------------------- */

export const useAvailableRooms = () =>
  useUnifiedRoomStore((s) => s.rooms);

export const useJoinedRooms = () =>
  useUnifiedRoomStore((s) =>
    s.rooms.filter(
      (r) => r.isMember && r.participationStatus === "accepted"
    )
  );

export const useSelectedRoom = () =>
  useUnifiedRoomStore((s) =>
    s.rooms.find((r) => r.id === s.selectedRoomId) ?? null
  );

export const useRoomLoading = () =>
  useUnifiedRoomStore((s) => s.isLoading);

export const useRoomError = () =>
  useUnifiedRoomStore((s) => s.error);

export const useRoomPresence = () =>
  useUnifiedRoomStore((s) => s.roomPresence);

// Typing selectors (for useTypingStatus / TypingIndicator)
export const useTypingUsers = () =>
  useUnifiedRoomStore((s) => s.typingUsers);

export const useTypingDisplayText = () =>
  useUnifiedRoomStore((s) => s.typingDisplayText);

export const useRoomActions = () =>
  useUnifiedRoomStore((s) => ({
    setSelectedRoomId: s.setSelectedRoomId,
    setUser: s.setUser,
    setLoading: s.setLoading,
    setError: s.setError,
    clearError: s.clearError,
    fetchRooms: s.fetchRooms,
    joinRoom: s.joinRoom,
    leaveRoom: s.leaveRoom,
    createRoom: s.createRoom,
    sendMessage: s.sendMessage,
    refreshRooms: s.refreshRooms,
    forceRefreshRooms: s.forceRefreshRooms,
    updateRoomMembership: s.updateRoomMembership,
    setRoomPresence: s.setRoomPresence,
    updateTypingUsers: s.updateTypingUsers,
    updateTypingText: s.updateTypingText,
  }));

/* -------------------------------------------------------
   UNIFIED REALTIME SYNC HOOK
------------------------------------------------------- */

// Track subscriptions per user to prevent duplicates
const userSubscriptions = new Map<string, boolean>();

export const useRoomRealtimeSync = (userId: string | null) => {
  const { forceRefreshRooms, updateRoomMembership } = useRoomActions();
  const supabase = getSupabaseBrowserClient();
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();
  const pendingUpdatesRef = useRef<Map<string, { roomId: string; status: string }>>(new Map());

  useEffect(() => {
    if (!userId) return;

    // Prevent duplicate listeners for same user
    if (userSubscriptions.has(userId)) {
      console.log(`📡 Realtime already active for user ${userId}`);
      return;
    }

    userSubscriptions.set(userId, true);
    console.log(`📡 Initializing unified realtime for user ${userId}`);

    const channel = supabase.channel(`room-realtime-${userId}`);

    // Unified function to update room status
    const updateRoomStatus = (roomId: string, status: "pending" | "accepted" | null) => {
      const isMember = status === "accepted";
      
      updateRoomMembership(roomId, {
        participationStatus: status,
        isMember: isMember,
      });
      
      console.log(`🔄 Updated room ${roomId} status to ${status}`);
    };

    // Debounced refresh
    const debouncedRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        console.log("🔄 Triggering debounced room refresh");
        forceRefreshRooms();
      }, 500);
    };

    /* ---------------------------------------------------------
       CASE 1: User clicks JOIN button (private room → pending)
    --------------------------------------------------------- */
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "room_participants",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const newRow = payload.new as RoomParticipantsRow;
        
        if (newRow.status === "pending" && newRow.room_id) {
          console.log("🔄 JOIN BUTTON: User pending in room_participants", payload);
          
          updateRoomStatus(newRow.room_id, "pending");
          debouncedRefresh();
        }
      }
    );

    /* ---------------------------------------------------------
       CASE 2: Owner ACCEPTS join request (pending → accepted)
    --------------------------------------------------------- */
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "room_participants",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const newRow = payload.new as RoomParticipantsRow;
        const oldRow = payload.old as RoomParticipantsRow;
        
        if (newRow.status === "accepted" && newRow.room_id && oldRow?.status === "pending") {
          console.log("✅ OWNER ACCEPTED: room_participants pending → accepted", payload);
          
          updateRoomStatus(newRow.room_id, "accepted");
          debouncedRefresh();
        }
      }
    );

    /* ---------------------------------------------------------
       CASE 3: room_members gets INSERTED (after acceptance)
    --------------------------------------------------------- */
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "room_members",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const newRow = payload.new as RoomMembersRow;
        
        if (newRow.status === "accepted" && newRow.room_id) {
          console.log("🎯 ROOM_MEMBERS INSERT: User accepted into room", payload);
          
          updateRoomStatus(newRow.room_id, "accepted");
          debouncedRefresh();
        }
      }
    );

    /* ---------------------------------------------------------
       CASE 4: Notification arrives (join_request_accepted)
    --------------------------------------------------------- */
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId} AND type=eq.join_request_accepted`,
      },
      (payload) => {
        const notification = payload.new as Database["public"]["Tables"]["notifications"]["Row"];
        
        if (notification.room_id) {
          console.log("🔔 NOTIFICATION: join_request_accepted received", payload);
          
          const updateKey = `${notification.room_id}-${userId}`;
          if (pendingUpdatesRef.current.has(updateKey)) {
            console.log("⏭️ Skipping duplicate update");
            return;
          }
          
          pendingUpdatesRef.current.set(updateKey, {
            roomId: notification.room_id,
            status: "accepted"
          });
          
          updateRoomStatus(notification.room_id, "accepted");
          
          setTimeout(() => {
            pendingUpdatesRef.current.delete(updateKey);
          }, 2000);
          
          debouncedRefresh();
        }
      }
    );

    /* ---------------------------------------------------------
       CASE 5: User leaves room
    --------------------------------------------------------- */
    channel.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "room_members",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const oldRow = payload.old as RoomMembersRow;
        
        if (oldRow?.room_id) {
          console.log("🗑️ USER LEFT: room_members deleted", payload);
          
          updateRoomStatus(oldRow.room_id, null);
          debouncedRefresh();
        }
      }
    );

    channel.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "room_participants",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const oldRow = payload.old as RoomParticipantsRow;
        
        if (oldRow?.room_id) {
          console.log("🗑️ USER LEFT: room_participants deleted", payload);
          
          updateRoomStatus(oldRow.room_id, null);
          debouncedRefresh();
        }
      }
    );

    /* ---------------------------------------------------------
       CASE 6: Messages for latest message updates
    --------------------------------------------------------- */
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const msg = payload.new as Database["public"]["Tables"]["messages"]["Row"];
        const roomId = msg.room_id;
        if (!roomId) return;

        // Update latest message
        updateRoomMembership(roomId, {
          latestMessage: msg.text ?? null,
          latest_message_created_at: msg.created_at,
        });

        // Increment unreadCount ONLY if you are not inside that room
        const selectedRoomId = useUnifiedRoomStore.getState().selectedRoomId;

        if (selectedRoomId !== roomId) {
          const room = useUnifiedRoomStore.getState().rooms.find((r) => r.id === roomId);
          if (room) {
            updateRoomMembership(roomId, {
              unreadCount: (room.unreadCount ?? 0) + 1,
            });
          }
        }
      }
    );

    /* ---------------------------------------------------------
       SUBSCRIBE & CLEANUP
    --------------------------------------------------------- */
    channel.subscribe((status) => {
      console.log(`📡 Unified realtime status for ${userId}:`, status);
      
      if (status === "SUBSCRIBED") {
        console.log("✅ Unified realtime connected successfully");
      }
    });

    return () => {
      console.log(`🧹 Cleaning up unified realtime for user ${userId}`);
      
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      pendingUpdatesRef.current.clear();
      supabase.removeChannel(channel);
      userSubscriptions.delete(userId);
    };
  }, [userId, forceRefreshRooms, updateRoomMembership]);
};

/* -------------------------------------------------------
   HELPERS: FETCH USERS FOR SEARCH
------------------------------------------------------- */

export const fetchAllUsers = async () => {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at");
  return data || [];
};

/* -------------------------------------------------------
   ENHANCED DEBUG HELPER
------------------------------------------------------- */
/* -------------------------------------------------------
   ENHANCED DEBUG HELPER - SIMPLIFIED VERSION
------------------------------------------------------- */
export const useDebugRoomSubscription = (userId: string | null) => {
  useEffect(() => {
    if (!userId) return;
    
    console.log("🔍 DEBUG: Setting up enhanced subscription check");
    
    const supabase = getSupabaseBrowserClient();
    
    const testChannel = supabase.channel(`debug-${userId}`);
    
    // Setup listeners
    testChannel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'room_participants',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        console.log("🔍 DEBUG: room_participants INSERT:", payload.new);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'room_participants',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        console.log("🔍 DEBUG: room_participants UPDATE:", {
          old: payload.old,
          new: payload.new
        });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'room_members',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        console.log("🔍 DEBUG: room_members INSERT:", payload.new);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId} AND type=eq.join_request_accepted`,
      }, (payload) => {
        console.log("🔍 DEBUG: join_request_accepted notification:", payload.new);
      });
    
    testChannel.subscribe((status) => {
      console.log("🔍 DEBUG: Subscription status:", status);
    });
    
    // Store channel reference for cleanup
    let channelRef = testChannel;
    
    return () => {
      if (channelRef) {
        supabase.removeChannel(channelRef);
      }
    };
  }, [userId]);
};