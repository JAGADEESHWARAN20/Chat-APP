// lib/store/unified-roomstore.ts
"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

/* ============================================================================
   TYPES
============================================================================ */

export interface RoomData {
  id: string;
  name: string;
  is_private: boolean;
  created_by: string | null;
  created_at: string;
  is_member: boolean;
  participation_status: "pending" | "accepted" | "rejected" | null;
  member_count: number;
  online_users: number;
  unread_count: number;
  latest_message: string | null;
  latest_message_created_at: string | null;
}

export interface NotificationData {
  id: string;
  type: string;
  room_id: string | null;
  sender_id: string | null;
  message: string;
  status: "read" | "unread";
  created_at: string;
  users?: any;
  rooms?: any;
}

/* ============================================================================
   STORE
============================================================================ */

interface UnifiedStore {
  // State
  userId: string | null;
  rooms: RoomData[];
  notifications: NotificationData[];
  isLoading: boolean;
  lastSync: number | null;
  selectedRoomId: string | null;
  typingUsers: { user_id: string; is_typing: boolean; display_name?: string }[];
  typingDisplayText: string;
  roomPresence: Record<string, { onlineUsers: number; userIds: string[]; lastUpdated?: string }>;

  setRoomPresence: (
    roomId: string,
    presence: { onlineUsers: number; userIds: string[]; lastUpdated?: string }
  ) => void;
  
  updateTypingUsers: (
    users: { user_id: string; is_typing: boolean; display_name?: string }[]
  ) => void;

  updateTypingText: (text: string) => void;

  // Setters
  setUserId: (id: string | null) => void;
  setRooms: (rooms: RoomData[]) => void;
  setNotifications: (notifications: NotificationData[]) => void;
  setSelectedRoomId: (id: string | null) => void;

  // Update operations
  updateRoom: (roomId: string, updates: Partial<RoomData>) => void;
  updateNotification: (
    notificationId: string,
    updates: Partial<NotificationData>
  ) => void;
  removeNotification: (notificationId: string) => void;
  addNotification: (notification: NotificationData) => void;

  // Realtime handlers
  handleParticipantChange: (payload: any) => void;
  handleMemberChange: (payload: any) => void;
  handleNotificationChange: (payload: any) => void;
  handleMessageInsert: (payload: any) => void;

  // Fetch
  fetchRooms: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchAll: () => Promise<void>;
}

export const useUnifiedStore = create<UnifiedStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    userId: null,
    rooms: [],
    notifications: [],
    isLoading: false,
    lastSync: null,
    selectedRoomId: null,
    typingUsers: [],
    typingDisplayText: "",
    roomPresence: {},
    setRoomPresence: (roomId, presence) =>
      set((state) => ({
        roomPresence: {
          ...state.roomPresence,
          [roomId]: presence,
        },
      })),
    
    updateTypingUsers: (users) =>
      set({
        typingUsers: [...users],
      }),
    
    updateTypingText: (text) =>
      set({
        typingDisplayText: text,
      }),
        
    /* ------------------------------------------------------------------------
       SETTERS
    ------------------------------------------------------------------------ */

    setUserId: (id) => set({ userId: id }),

    setRooms: (rooms) => set({ rooms, lastSync: Date.now() }),

    setNotifications: (notifications) => set({ notifications }),

    setSelectedRoomId: (id) => {
      set({ selectedRoomId: id });

      // Reset unread count when opening room
      if (id) {
        set((state) => ({
          rooms: state.rooms.map((room) =>
            room.id === id ? { ...room, unread_count: 0 } : room
          ),
        }));
      }
    },

    /* ------------------------------------------------------------------------
       UPDATE OPERATIONS
    ------------------------------------------------------------------------ */

    updateRoom: (roomId, updates) => {
      set((state) => ({
        rooms: state.rooms.map((room) =>
          room.id === roomId ? { ...room, ...updates } : room
        ),
      }));
    },

    updateNotification: (notificationId, updates) => {
      set((state) => ({
        notifications: state.notifications.map((notif) =>
          notif.id === notificationId ? { ...notif, ...updates } : notif
        ),
      }));
    },

    removeNotification: (notificationId) => {
      set((state) => ({
        notifications: state.notifications.filter(
          (n) => n.id !== notificationId
        ),
      }));
    },

    addNotification: (notification) => {
      set((state) => ({
        notifications: [notification, ...state.notifications],
      }));
    },

    /* ------------------------------------------------------------------------
       REALTIME HANDLERS - Single Source of Truth
    ------------------------------------------------------------------------ */

    handleParticipantChange: (payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      const currentUserId = get().userId;

      // Only process events for current user
      if (!newRow?.room_id || newRow.user_id !== currentUserId) return;

      console.log("🔄 Participant change:", { eventType, newRow });

      // UPDATE: pending → accepted
      if (eventType === "UPDATE" && newRow.status !== oldRow?.status) {
        get().updateRoom(newRow.room_id, {
          participation_status: newRow.status,
          is_member: newRow.status === "accepted",
        });
      }

      // INSERT: User joins (either pending or accepted)
      if (eventType === "INSERT") {
        get().updateRoom(newRow.room_id, {
          participation_status: newRow.status,
          is_member: newRow.status === "accepted",
        });
      }

      // DELETE: User leaves
      if (eventType === "DELETE" && oldRow?.room_id) {
        get().updateRoom(oldRow.room_id, {
          participation_status: null,
          is_member: false,
        });
      }
    },

    handleMemberChange: (payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;

      // INSERT: Increment member count
      if (eventType === "INSERT" && newRow?.room_id) {
        console.log("✅ Member added:", newRow);
        set((state) => ({
          rooms: state.rooms.map((room) =>
            room.id === newRow.room_id
              ? { ...room, member_count: room.member_count + 1 }
              : room
          ),
        }));
      }

      // DELETE: Decrement member count
      if (eventType === "DELETE" && oldRow?.room_id) {
        console.log("🗑️ Member removed:", oldRow);
        set((state) => ({
          rooms: state.rooms.map((room) =>
            room.id === oldRow.room_id
              ? { ...room, member_count: Math.max(0, room.member_count - 1) }
              : room
          ),
        }));
      }
    },

    handleNotificationChange: (payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      const currentUserId = get().userId;

      // INSERT: New notification
      if (eventType === "INSERT" && newRow?.user_id === currentUserId) {
        console.log("🔔 New notification:", newRow);

        get().addNotification(newRow as NotificationData);

        // Update room unread count
        if (newRow.room_id) {
          set((state) => ({
            rooms: state.rooms.map((room) =>
              room.id === newRow.room_id
                ? { ...room, unread_count: room.unread_count + 1 }
                : room
            ),
          }));
        }
      }

      // DELETE: Remove notification
      if (eventType === "DELETE" && oldRow?.id) {
        console.log("🗑️ Notification deleted:", oldRow);
        get().removeNotification(oldRow.id);
      }

      // UPDATE: Notification status changed
      if (eventType === "UPDATE" && newRow?.id) {
        console.log("📝 Notification updated:", newRow);
        get().updateNotification(newRow.id, newRow);
      }
    },

    handleMessageInsert: (payload) => {
      const { new: newRow } = payload;
      if (!newRow?.room_id) return;

      console.log("💬 New message:", newRow);

      const selectedRoomId = get().selectedRoomId;

      // Update latest message
      get().updateRoom(newRow.room_id, {
        latest_message: newRow.text,
        latest_message_created_at: newRow.created_at,
      });

      // Increment unread count ONLY if not in that room
      if (selectedRoomId !== newRow.room_id) {
        set((state) => ({
          rooms: state.rooms.map((room) =>
            room.id === newRow.room_id
              ? { ...room, unread_count: room.unread_count + 1 }
              : room
          ),
        }));
      }
    },

    /* ------------------------------------------------------------------------
       FETCH OPERATIONS
    ------------------------------------------------------------------------ */

    fetchRooms: async () => {
      const userId = get().userId;
      if (!userId) return;

      set({ isLoading: true });

      try {
        const supabase = getSupabaseBrowserClient();

        const { data, error } = await supabase.rpc("get_unified_room_data", {
          p_user_id: userId,
        });

        if (error) throw error;

        set({
          rooms: (data || []).map((r: any) => ({
            ...r,
            participation_status:
              r.participation_status === "accepted" ||
              r.participation_status === "pending" ||
              r.participation_status === "rejected"
                ? r.participation_status
                : null,
        
            online_users: r.online_users ?? 0,
            unread_count: r.unread_count ?? 0,
          })),
          lastSync: Date.now(),
        });
        
      } catch (error) {
        console.error("❌ fetchRooms error:", error);
      } finally {
        set({ isLoading: false });
      }
    },

    fetchNotifications: async () => {
      const userId = get().userId;
      if (!userId) return;

      try {
        const supabase = getSupabaseBrowserClient();

        const { data, error } = await supabase
          .from("notifications")
          .select(
            `
            *,
            sender:profiles!notifications_sender_id_fkey(id,username,display_name,avatar_url),
            rooms:rooms(id,name)
          `
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;

        set({
          notifications: (data || []).map((n: any) => ({
            ...n,
            status: n.status === "read" || n.status === "unread"
              ? n.status
              : "unread",
          })),
        });
        
      } catch (error) {
        console.error("❌ fetchNotifications error:", error);
      }
    },

    fetchAll: async () => {
      await Promise.all([get().fetchRooms(), get().fetchNotifications()]);
    },
  }))
);

/* ============================================================================
   SELECTORS
============================================================================ */

export const useRooms = () => useUnifiedStore((s) => s.rooms);

export const useJoinedRooms = () =>
  useUnifiedStore((s) =>
    s.rooms.filter((r) => r.is_member && r.participation_status === "accepted")
  );

export const useNotifications = () =>
  useUnifiedStore((s) => s.notifications);

export const useUnreadCount = () =>
  useUnifiedStore((s) => s.notifications.filter((n) => n.status === "unread").length);

export const useRoomById = (roomId: string | null) =>
  useUnifiedStore((s) => s.rooms.find((r) => r.id === roomId) ?? null);

/* ============================================================================
   UNIFIED REALTIME HOOK
============================================================================ */

const activeSubscriptions = new Map<string, boolean>();

export const useUnifiedRealtime = (userId: string | null) => {
  const store = useUnifiedStore();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!userId) return;

    // Prevent duplicate subscriptions
    if (activeSubscriptions.has(userId)) {
      console.log("⏭️ Realtime already active for user:", userId);
      return;
    }

    activeSubscriptions.set(userId, true);
    console.log("🎯 Starting unified realtime for user:", userId);

    // Create single channel for all subscriptions
    const channel = supabase.channel(`unified-realtime-${userId}`);

    // Subscribe to all relevant tables
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_participants",
          filter: `user_id=eq.${userId}`,
        },
        store.handleParticipantChange
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_members",
        },
        store.handleMemberChange
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        store.handleNotificationChange
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        store.handleMessageInsert
      )
      .subscribe((status) => {
        console.log("📡 Realtime status:", status);
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      console.log("🧹 Cleaning up realtime for user:", userId);

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      activeSubscriptions.delete(userId);
    };
  }, [userId, store, supabase]);
};

/* ============================================================================
   ACTIONS HOOK
============================================================================ */

export const useRoomActions = () => {
  const store = useUnifiedStore();
  const supabase = getSupabaseBrowserClient();

  return {
    joinRoom: async (roomId: string) => {
      const room = store.rooms.find((r) => r.id === roomId);
      if (!room) return false;

      // Optimistic update
      store.updateRoom(roomId, {
        participation_status: room.is_private ? "pending" : "accepted",
        is_member: !room.is_private,
      });

      try {
        const res = await fetch(`/api/rooms/${roomId}/join`, {
          method: "POST",
        });

        if (!res.ok) {
          // Rollback
          store.updateRoom(roomId, {
            participation_status: null,
            is_member: false,
          });
          return false;
        }

        return true;
      } catch (error) {
        console.error("❌ joinRoom error:", error);
        // Rollback
        store.updateRoom(roomId, {
          participation_status: null,
          is_member: false,
        });
        return false;
      }
    },

    leaveRoom: async (roomId: string) => {
      // Optimistic update
      store.updateRoom(roomId, {
        is_member: false,
        participation_status: null,
      });

      try {
        const res = await fetch(`/api/rooms/${roomId}/leave`, {
          method: "PATCH",
        });

        if (!res.ok) {
          await store.fetchRooms(); // Sync from server on error
          return false;
        }

        return true;
      } catch (error) {
        console.error("❌ leaveRoom error:", error);
        await store.fetchRooms(); // Sync from server on error
        return false;
      }
    },
    sendMessage: async (roomId: string, text: string) => {
      try {
        const { error } = await supabase
          .from("messages")
          .insert({
            room_id: roomId,
            text,
          });

        if (error) {
          console.error("sendMessage error:", error);
          return false;
        }

        return true;
      } catch (err) {
        console.error("sendMessage error:", err);
        return false;
      }
    },
    createRoom: async (roomName: string, isPrivate: boolean) => {
      const supabase = getSupabaseBrowserClient();
      const userId = store.userId;
    
      if (!userId) throw new Error("User not authenticated");
    
      try {
        const { data, error } = await supabase
          .from("rooms")
          .insert({
            name: roomName,
            is_private: isPrivate,
            created_by: userId,
          })
          .select("*")
          .single();
    
        if (error) {
          console.error("❌ createRoom error:", error);
          throw new Error("Failed to create room");
        }
    
        // Add room immediately to UI
        store.setRooms([
          {
            ...data,
            is_member: true,
            participation_status: "accepted",
            member_count: 1,
            online_users: 0,
            unread_count: 0,
            latest_message: null,
            latest_message_created_at: null,
          },
          ...store.rooms,
        ]);
    
        return data;
      } catch (err) {
        console.error("❌ createRoom error:", err);
        throw err;
      }
    },
    

    acceptJoinRequest: async (notificationId: string, roomId: string) => {
      // Optimistic update
      store.updateRoom(roomId, {
        participation_status: "accepted",
        is_member: true,
      });

      try {
        const res = await fetch(`/api/notifications/${notificationId}/accept`, {
          method: "POST",
        });

        if (!res.ok) {
          await store.fetchRooms(); // Sync from server on error
          return false;
        }

        // Remove notification
        store.removeNotification(notificationId);

        return true;
      } catch (error) {
        console.error("❌ acceptJoinRequest error:", error);
        await store.fetchRooms(); // Sync from server on error
        return false;
      }
    },

    setSelectedRoomId: store.setSelectedRoomId,
    fetchRooms: store.fetchRooms,
    fetchNotifications: store.fetchNotifications,
    fetchAll: store.fetchAll,
  };
};
export const useRoomPresence = () =>
  useUnifiedStore((s) => s.roomPresence);

// Select current room object
export const useSelectedRoom = () =>
  useUnifiedStore((s) =>
    s.selectedRoomId ? s.rooms.find((r) => r.id === s.selectedRoomId) : null
  );

// Select list of rooms (wrapper)
export const useAvailableRooms = () =>
  useUnifiedStore((s) => s.rooms);
