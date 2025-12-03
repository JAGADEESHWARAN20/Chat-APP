// lib/store/unified-roomstore.ts
"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "@/components/ui/sonner";

/**
 * Note: This module intentionally avoids calling React hooks at top-level.
 * Realtime connect/disconnect helpers are pure functions. A small hook
 * wrapper is exported as `useUnifiedRealtime` for components that want to
 * opt-in (it will use useEffect internally).
 */

/* ============================
   Types
   ============================ */
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

export interface UserData {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
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

/* ============================
   Simple event dispatcher
   (keeps ephemeral listeners out of zustand)
   ============================ */
type EventHandler = (payload: any) => void;
class Dispatcher {
  private handlers = new Map<string, Set<EventHandler>>();
  on(evt: string, h: EventHandler) {
    const s = this.handlers.get(evt) ?? new Set();
    s.add(h);
    this.handlers.set(evt, s);
    return () => this.off(evt, h);
  }
  off(evt: string, h?: EventHandler) {
    if (!h) return this.handlers.delete(evt);
    const s = this.handlers.get(evt);
    if (!s) return;
    s.delete(h);
    if (s.size === 0) this.handlers.delete(evt);
  }
  emit(evt: string, payload?: any) {
    const s = this.handlers.get(evt);
    if (!s) return;
    for (const h of Array.from(s)) {
      try {
        h(payload);
      } catch (err) {
        console.error("dispatcher handler error", err);
      }
    }
  }
}
const dispatcher = new Dispatcher();

/* ============================
   Utilities
   ============================ */
const now = () => Date.now();
const clamp = (v: number, min = 0) => (v < min ? min : v);

/* ============================
   Unified store interface
   ============================ */
interface UnifiedStore {
  userId: string | null;
  rooms: RoomData[];
  users: UserData[];
  notifications: NotificationData[];
  isLoading: boolean;
  lastSync: number | null;
  activeTab: "home" | "search";
  selectedRoomId: string | null;
  typingUsers: { user_id: string; is_typing: boolean; display_name?: string }[];
  typingDisplayText: string;
  roomPresence: Record<string, { onlineUsers: number; userIds: string[]; lastUpdated?: string }>;

  // Global search state
  sidebarSearchTerm: string;
  setSidebarSearchTerm: (v: string) => void;

  // setters
  setUserId: (id: string | null) => void;
  setRooms: (rooms: RoomData[]) => void;
  setUsers: (users: UserData[]) => void;
  setNotifications: (notifications: NotificationData[]) => void;
  setSelectedRoomId: (id: string | null) => void;
  setActiveTab: (tab: "home" | "search") => void;
  setRoomPresence: (roomId: string, presence: { onlineUsers: number; userIds: string[]; lastUpdated?: string }) => void;
  updateTypingUsers: (users: { user_id: string; is_typing: boolean; display_name?: string }[]) => void;
  updateTypingText: (text: string) => void;

  // updates
  updateRoom: (roomId: string, updates: Partial<RoomData>) => void;
  updateNotification: (notificationId: string, updates: Partial<NotificationData>) => void;
  removeNotification: (notificationId: string) => void;
  addNotification: (notification: NotificationData) => void;

  // realtime handlers (public)
  handleParticipantChange: (payload: any) => void;
  handleMemberChange: (payload: any) => void;
  handleNotificationChange: (payload: any) => void;
  handleMessageInsert: (payload: any) => void;

  // fetch
  fetchRooms: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchNotificationById: (id: string) => Promise<NotificationData | null>;
  fetchAll: () => Promise<void>;

  // dispatcher api
  dispatch: (evt: string, payload?: any) => void;
  on: (evt: string, h: EventHandler) => () => void;

  // background jobs (internal control)
  _startBackgroundJobs: (userId: string) => void;
  _stopBackgroundJobs: () => void;
}

/* ============================
   Create store
   ============================ */
export const useUnifiedStore = create<UnifiedStore>()(
  subscribeWithSelector((set, get) => {
    // background job refs
    let bgIntervals: ReturnType<typeof setInterval>[] = [];
    let bgRunning = false;

    const startBackgroundJobs = (userId: string) => {
      if (!userId || bgRunning) return;
      bgRunning = true;

      // Refresh rooms every 60s
      bgIntervals.push(
        setInterval(() => {
          get().fetchRooms().catch((e) => console.error("bg fetchRooms", e));
        }, 60_000)
      );
      // Refresh notifications every 30s
      bgIntervals.push(
        setInterval(() => {
          get().fetchNotifications().catch((e) => console.error("bg fetchNotifications", e));
        }, 30_000)
      );
      // Quick presence tick every 10s -> uses fetchRooms for minimal presence update
      bgIntervals.push(
        setInterval(() => {
          get().fetchRooms().catch((e) => console.error("bg presence fetch", e));
        }, 10_000)
      );
    };

    const stopBackgroundJobs = () => {
      for (const id of bgIntervals) clearInterval(id);
      bgIntervals = [];
      bgRunning = false;
    };

    // safe updaters
    const safeUpdateRoom = (roomId: string, updates: Partial<RoomData>) =>
      set((s) => ({ rooms: s.rooms.map((r) => (r.id === roomId ? { ...r, ...updates } : r)) }));

    const safeAddNotification = (n: NotificationData) =>
      set((s) => ({ notifications: [n, ...s.notifications] }));

    return {
      // initial state
      userId: null,
      rooms: [],
      users: [],
      notifications: [],
      isLoading: false,
      lastSync: null,
      activeTab: "home",
      selectedRoomId: null,
      typingUsers: [],
      typingDisplayText: "",
      roomPresence: {},
      sidebarSearchTerm: "",
      setSidebarSearchTerm: (v: string) => set({ sidebarSearchTerm: v }),

      // dispatcher
      dispatch: (evt: string, payload?: any) => dispatcher.emit(evt, payload),
      on: (evt: string, h: EventHandler) => dispatcher.on(evt, h),

      // setters
      setUserId: (id: string | null) => set({ userId: id }),
      setRooms: (rooms: RoomData[]) => set({ rooms, lastSync: now() }),
      setUsers: (users: UserData[]) => set({ users }),
      setNotifications: (notifications: NotificationData[]) => set({ notifications }),
      setSelectedRoomId: (id: string | null) => {
        set({ selectedRoomId: id });
        if (id) {
          // reset unread on open
          set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? { ...r, unread_count: 0 } : r)) }));
        }
      },
      setActiveTab: (tab) => set({ activeTab: tab }),
      setRoomPresence: (roomId, presence) => set((s) => ({ roomPresence: { ...s.roomPresence, [roomId]: presence } })),
      updateTypingUsers: (users) => set({ typingUsers: [...users] }),
      updateTypingText: (text) => set({ typingDisplayText: text }),

      // updates
      updateRoom: (roomId, updates) => safeUpdateRoom(roomId, updates),
      updateNotification: (notificationId, updates) =>
        set((s) => ({ notifications: s.notifications.map((n) => (n.id === notificationId ? { ...n, ...updates } : n)) })),
      removeNotification: (notificationId) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== notificationId) })),
      addNotification: (notification) => safeAddNotification(notification),

      // fetch implementations (defensive)
      fetchRooms: async () => {
        const userId = get().userId;
        if (!userId) return;
        set({ isLoading: true });
        try {
          const supabase = getSupabaseBrowserClient();
          const { data, error } = await supabase.rpc("get_unified_room_data", { p_user_id: userId });
          if (error) throw error;
          set({
            rooms: (data || []).map((r: any) => ({
              id: r.id,
              name: r.name,
              is_private: !!r.is_private,
              created_by: r.created_by ?? null,
              created_at: r.created_at ?? new Date().toISOString(),
              is_member: !!r.is_member,
              participation_status:
                r.participation_status === "accepted" || r.participation_status === "pending" || r.participation_status === "rejected"
                  ? r.participation_status
                  : null,
              member_count: Number(r.member_count ?? 0),
              online_users: Number(r.online_users ?? 0),
              unread_count: Number(r.unread_count ?? 0),
              latest_message: r.latest_message ?? null,
              latest_message_created_at: r.latest_message_created_at ?? null,
            })),
            lastSync: Date.now(),
          });
        } catch (err) {
          console.error("fetchRooms error:", err);
        } finally {
          set({ isLoading: false });
        }
      },

      fetchUsers: async () => {
        try {
          const res = await fetch("/api/users");
          if (!res.ok) throw new Error("Failed to fetch users");
          const data = await res.json();
          get().setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
          console.error("fetchUsers error:", err);
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
              status: n.status === "read" || n.status === "unread" ? n.status : "unread",
            })),
          });
        } catch (err) {
          console.error("fetchNotifications error:", err);
        }
      },

      fetchNotificationById: async (id: string) => {
        const userId = get().userId;
        if (!userId) return null;
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
            .eq("id", id)
            .single();
          if (error) throw error;
          return { ...data, status: data.status === "read" || data.status === "unread" ? data.status : "unread" } as NotificationData;
        } catch (err) {
          console.error("fetchNotificationById error:", err);
          return null;
        }
      },

      fetchAll: async () => {
        const p = [get().fetchRooms(), get().fetchUsers(), get().fetchNotifications()];
        await Promise.all(p);
      },

      // realtime handlers - these mutate store and emit events
      handleParticipantChange: (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload;
        const currentUserId = get().userId;
        if (!newRow?.room_id || newRow.user_id !== currentUserId) return;

        if (eventType === "INSERT") {
          safeUpdateRoom(newRow.room_id, {
            participation_status: newRow.status,
            is_member: newRow.status === "accepted",
          });
          dispatcher.emit("participant:insert", { newRow });
        }

        if (eventType === "UPDATE" && newRow.status !== oldRow?.status) {
          safeUpdateRoom(newRow.room_id, {
            participation_status: newRow.status,
            is_member: newRow.status === "accepted",
          });
          // quickly reconcile canonical state
          get().fetchRooms().catch(() => {});
          dispatcher.emit("participant:update", { newRow, oldRow });
        }

        if (eventType === "DELETE" && oldRow?.room_id) {
          safeUpdateRoom(oldRow.room_id, { participation_status: null, is_member: false });
          dispatcher.emit("participant:delete", { oldRow });
        }
      },

      handleMemberChange: (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === "INSERT" && newRow?.room_id) {
          set((s) => ({ rooms: s.rooms.map((room) => (room.id === newRow.room_id ? { ...room, member_count: room.member_count + 1 } : room)) }));
          dispatcher.emit("member:insert", newRow);
        }
        if (eventType === "DELETE" && oldRow?.room_id) {
          set((s) => ({ rooms: s.rooms.map((room) => (room.id === oldRow.room_id ? { ...room, member_count: clamp(room.member_count - 1) } : room)) }));
          dispatcher.emit("member:delete", oldRow);
        }
      },

      handleNotificationChange: async (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload;
        const currentUserId = get().userId;
        if (eventType === "INSERT" && newRow?.user_id === currentUserId) {
          safeAddNotification(newRow as NotificationData);
          const fullNotif = await get().fetchNotificationById(newRow.id);
          if (fullNotif) get().updateNotification(newRow.id, fullNotif);
          if (newRow.room_id) {
            set((s) => ({ rooms: s.rooms.map((room) => (room.id === newRow.room_id ? { ...room, unread_count: room.unread_count + 1 } : room)) }));
          }
          // side-effects
          switch (newRow.type) {
            case "join_request_accepted":
              toast.success("Your request to join a room was accepted!", { description: newRow.message ?? "" });
              await get().fetchRooms();
              dispatcher.emit("notification:join_accepted", newRow);
              break;
            case "join_request_rejected":
              toast.error("Your join request was rejected.");
              dispatcher.emit("notification:join_rejected", newRow);
              break;
            case "room_invite":
              toast.info("You were invited to a room.");
              dispatcher.emit("notification:room_invite", newRow);
              break;
            case "message":
              toast.info(`${newRow.users?.username || newRow.users?.display_name || "someone"}: ${newRow.message}`);
              dispatcher.emit("notification:message", newRow);
              break;
            default:
              toast(newRow.message ?? "New notification");
              dispatcher.emit("notification:other", newRow);
          }
        }

        if (eventType === "DELETE" && oldRow?.id) {
          get().removeNotification(oldRow.id);
          dispatcher.emit("notification:deleted", oldRow);
        }

        if (eventType === "UPDATE" && newRow?.id) {
          get().updateNotification(newRow.id, newRow);
          dispatcher.emit("notification:updated", newRow);
        }
      },

      handleMessageInsert: (payload) => {
        const { new: newRow } = payload;
        if (!newRow?.room_id) return;
        const selectedRoomId = get().selectedRoomId;

        safeUpdateRoom(newRow.room_id, {
          latest_message: newRow.text,
          latest_message_created_at: newRow.created_at,
        });

        if (selectedRoomId !== newRow.room_id) {
          set((s) => ({ rooms: s.rooms.map((room) => (room.id === newRow.room_id ? { ...room, unread_count: room.unread_count + 1 } : room)) }));
        }

        dispatcher.emit("message:insert", newRow);
      },

      _startBackgroundJobs: (userId: string) => startBackgroundJobs(userId),
      _stopBackgroundJobs: () => stopBackgroundJobs(),
    } as UnifiedStore;
  })
);

/* ============================
   Selectors / convenience hooks
   (keeps compatibility with previous exports)
   ============================ */
export const useRooms = () => useUnifiedStore((s) => s.rooms);
export const useUsers = () => useUnifiedStore((s) => s.users);
export const useJoinedRooms = () => useUnifiedStore((s) => s.rooms.filter((r) => r.is_member && r.participation_status === "accepted"));
export const useNotifications = () => useUnifiedStore((s) => s.notifications);
export const useUnreadCount = () => useUnifiedStore((s) => s.notifications.filter((n) => n.status === "unread").length);
export const useRoomById = (roomId: string | null) => useUnifiedStore((s) => (roomId ? s.rooms.find((r) => r.id === roomId) ?? null : null));
export const useSelectedRoom = () => useUnifiedStore((s) => (s.selectedRoomId ? s.rooms.find((r) => r.id === s.selectedRoomId) : null));
export const useAvailableRooms = () => useUnifiedStore((s) => s.rooms);
export const useTypingUsers = () => useUnifiedStore((s) => s.typingUsers);
export const useTypingDisplayText = () => useUnifiedStore((s) => s.typingDisplayText);

/* ============================
   Realtime manager (pure functions)
   - initUnifiedRealtime(userId)
   - teardownUnifiedRealtime(userId)
   - export a small React hook wrapper `useUnifiedRealtime(userId)` for convenience
   ============================ */

/**
 * activeRealtime Map stores either the RealtimeChannel or boolean sentinel
 * so multiple init calls won't duplicate subscriptions.
 */
const activeRealtime = new Map<string, RealtimeChannel | boolean>();

export async function initUnifiedRealtime(userId: string | null) {
  if (!userId) return;
  if (activeRealtime.has(userId)) {
    // already initialized
    return;
  }

  try {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`unified-realtime-${userId}`);

    // bind listeners using the store handlers (they mutate store directly)
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants", filter: `user_id=eq.${userId}` },
        (payload: any) => useUnifiedStore.getState().handleParticipantChange(payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members" },
        (payload: any) => useUnifiedStore.getState().handleMemberChange(payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload: any) => useUnifiedStore.getState().handleNotificationChange(payload)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: any) => useUnifiedStore.getState().handleMessageInsert(payload)
      )
      .subscribe((status) => {
        console.log("unified realtime status:", status);
      });

    activeRealtime.set(userId, channel);
    console.log("started unified realtime for", userId);
  } catch (err) {
    console.error("initUnifiedRealtime error:", err);
  }
}

export function teardownUnifiedRealtime(userId: string | null) {
  if (!userId) return;
  const val = activeRealtime.get(userId);
  if (!val) return;
  try {
    // If it's a channel, remove it
    const supabase = getSupabaseBrowserClient();
    if (typeof (val as any).subscription !== "undefined" || (val as any).unsubscribe) {
      // treat as channel object
      supabase.removeChannel(val as RealtimeChannel);
    }
  } catch (err) {
    console.error("teardownUnifiedRealtime removeChannel error:", err);
  } finally {
    activeRealtime.delete(userId);
    console.log("stopped unified realtime for", userId);
  }
}

/* ------------------------------------------------------------------
   React hook wrapper for convenience and backward compatibility.
   - This hook is lightweight: uses useEffect to call initUnifiedRealtime & teardownUnifiedRealtime.
   - MUST be called only inside React components.
------------------------------------------------------------------ */
import { useEffect, useRef } from "react";
export const useUnifiedRealtime = (userId: string | null) => {
  const startedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    // don't re-init if same user already active in this hook instance
    if (startedRef.current === userId) return;
    startedRef.current = userId;

    initUnifiedRealtime(userId).catch((e) => console.error("initUnifiedRealtime hook error", e));

    return () => {
      // only teardown for this userId instance
      teardownUnifiedRealtime(userId);
      startedRef.current = null;
    };
  }, [userId]);
};

/* ============================
   Actions API (compatibility)
   ============================ */
export const useRoomActions = () => {
  const store = useUnifiedStore();
  const supabase = getSupabaseBrowserClient();

  return {
    joinRoom: async (roomId: string) => {
      const room = store.rooms.find((r) => r.id === roomId);
      if (!room) return false;

      store.updateRoom(roomId, {
        participation_status: room.is_private ? "pending" : "accepted",
        is_member: !room.is_private,
      });

      try {
        const res = await fetch(`/api/rooms/${roomId}/join`, { method: "POST" });
        if (!res.ok) {
          store.updateRoom(roomId, { participation_status: null, is_member: false });
          return false;
        }
        return true;
      } catch (err) {
        console.error("joinRoom error:", err);
        store.updateRoom(roomId, { participation_status: null, is_member: false });
        return false;
      }
    },

    leaveRoom: async (roomId: string) => {
      store.updateRoom(roomId, { is_member: false, participation_status: null });
      try {
        const res = await fetch(`/api/rooms/${roomId}/leave`, { method: "PATCH" });
        if (!res.ok) {
          await store.fetchRooms();
          return false;
        }
        return true;
      } catch (err) {
        console.error("leaveRoom error:", err);
        await store.fetchRooms();
        return false;
      }
    },

    sendMessage: async (roomId: string, text: string) => {
      try {
        const { error } = await supabase.from("messages").insert({ room_id: roomId, text });
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
      const userId = useUnifiedStore.getState().userId;
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
        if (error) throw error;

        useUnifiedStore.setState((s) => ({
          rooms: [
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
            ...s.rooms,
          ],
        }));

        return data;
      } catch (err) {
        console.error("createRoom error:", err);
        throw err;
      }
    },

    acceptJoinRequest: async (notificationId: string, roomId: string) => {
      try {
        const res = await fetch(`/api/notifications/${notificationId}/accept`, { method: "POST" });
        if (!res.ok) {
          await useUnifiedStore.getState().fetchRooms();
          return false;
        }
        useUnifiedStore.getState().removeNotification(notificationId);
        return true;
      } catch (err) {
        console.error("acceptJoinRequest error:", err);
        await useUnifiedStore.getState().fetchRooms();
        return false;
      }
    },

    // convenience wrappers
    setSelectedRoomId: (id: string | null) => useUnifiedStore.getState().setSelectedRoomId(id),
    fetchRooms: () => useUnifiedStore.getState().fetchRooms(),
    fetchUsers: () => useUnifiedStore.getState().fetchUsers(),
    fetchNotifications: () => useUnifiedStore.getState().fetchNotifications(),
    fetchAll: () => useUnifiedStore.getState().fetchAll(),
  };
};

/* ============================
   Background jobs starter (public)
   ============================ */
export function startUnifiedBackgroundJobs(userId: string | null) {
  if (!userId) return;
  useUnifiedStore.getState()._startBackgroundJobs(userId);
}
export function stopUnifiedBackgroundJobs() {
  useUnifiedStore.getState()._stopBackgroundJobs();
}

/* ============================
   End
   ============================ */
