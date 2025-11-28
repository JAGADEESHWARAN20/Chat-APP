// lib/store/enhanced-notifications.ts
"use client";
import React from "react";
import { create } from "zustand";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/lib/types/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import { SafeSupabaseQuery } from "@/lib/utils/supabase-queries";

// ---- Enhanced Types ----
type ProfileType = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

type RoomType = {
  id: string;
  name: string;
  created_at: string;
  created_by: string | null;
  is_private: boolean;
};

export interface Inotification {
  id: string;
  message: string;
  created_at: string | null;
  status: string | null;
  type: string;
  sender_id: string | null;
  user_id: string;
  room_id: string | null;
  join_status: string | null;
  direct_chat_id: string | null;
  users: ProfileType | null;
  recipient: ProfileType | null;
  rooms: RoomType | null;
}

type RawNotification = Database["public"]["Tables"]["notifications"]["Row"];

// Extended type for joined notifications with relationships
type NotificationWithRelations = RawNotification & {
  sender?: ProfileType | null;
  recipient?: ProfileType | null;
  room?: RoomType | null;
};

type ConnectionHealth = 'healthy' | 'degraded' | 'offline';

interface EnhancedNotificationState {
  notifications: Inotification[];
  unreadCount: number;
  isLoading: boolean;
  hasError: boolean;
  lastFetch: number | null;
  subscriptionActive: boolean;
  connectionHealth: ConnectionHealth;
  lastSuccessfulFetch: number | null;

  // Core actions
  setNotifications: (notifications: Inotification[]) => void;
  addNotification: (notification: Inotification) => void;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  removeNotification: (notificationId: string) => void;
  fetchNotifications: (userId: string) => Promise<void>;
  subscribeToNotifications: (userId: string) => void;
  unsubscribeFromNotifications: () => void;
  clearError: () => void;
  retrySubscription: (userId: string) => void;
  
  // Enhanced actions
  setConnectionHealth: (health: ConnectionHealth) => void;
  setLastSuccessfulFetch: (timestamp: number) => void;
}

// Constants
const MAX_RETRY_ATTEMPTS = 3;
const CACHE_TTL = 30000; // 30 seconds
const STALE_TTL = 60000; // 1 minute

let notificationChannel: RealtimeChannel | null = null;
let subscriptionRetryCount = 0;

// Utility functions
const normalizeNotificationType = (dbType: string): string => {
  const typeMap: Record<string, string> = {
    join_request: "join_request",
    new_message: "message",
    room_switch: "room_invite",
    user_joined: "user_joined",
    join_request_rejected: "join_request_rejected",
    join_request_accepted: "join_request_accepted",
    notification_unread: "notification_unread",
    room_left: "room_left",
  };

  return typeMap[dbType] || dbType;
};

// Transform from DB+joins to Inotification
const transformNotification = (
  notif: NotificationWithRelations
): Inotification => {
  const users = notif.sender || null;
  const recipient = notif.recipient || null;
  const rooms = notif.room || null;

  const normalizedType = normalizeNotificationType(notif.type);

  return {
    id: notif.id,
    message: notif.message,
    created_at: notif.created_at ?? null,
    status: notif.status,
    type: normalizedType,
    sender_id: notif.sender_id ?? null,
    user_id: notif.user_id,
    room_id: notif.room_id ?? null,
    join_status: notif.join_status,
    direct_chat_id: notif.direct_chat_id ?? null,
    users: users
      ? {
          id: users.id,
          username: users.username,
          display_name: users.display_name,
          avatar_url: users.avatar_url ?? null,
          created_at: users.created_at,
        }
      : null,
    recipient: recipient
      ? {
          id: recipient.id,
          username: recipient.username,
          display_name: recipient.display_name,
          avatar_url: recipient.avatar_url ?? null,
          created_at: recipient.created_at,
        }
      : null,
    rooms: rooms
      ? {
          id: rooms.id,
          name: rooms.name,
          created_at: rooms.created_at,
          created_by: rooms.created_by ?? null,
          is_private: rooms.is_private,
        }
      : null,
  };
};

// Safe query functions
const safeFetchNotifications = async (userId: string) => {
  const supabase = getSupabaseBrowserClient();
  
  try {
    const queryPromise = supabase
      .from("notifications")
      .select(
        `
        *,
        sender:profiles!notifications_sender_id_fkey(
          id, username, display_name, avatar_url, created_at
        ),
        recipient:profiles!notifications_user_id_fkey(
          id, username, display_name, avatar_url, created_at
        ),
        room:rooms!notifications_room_id_fkey(
          id, name, created_at, created_by, is_private
        )
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const result = await queryPromise;

    return SafeSupabaseQuery.array<NotificationWithRelations>(
      Promise.resolve({
        data: result.data as NotificationWithRelations[] | null,
        error: result.error,
      })
    );
  } catch (error) {
    console.error("Error in safeFetchNotifications:", error);
    return { data: [], error };
  }
};

const safeFetchSingleNotification = async (notificationId: string) => {
  const supabase = getSupabaseBrowserClient();
  
  try {
    const queryPromise = supabase
      .from("notifications")
      .select(
        `
        *,
        sender:profiles!notifications_sender_id_fkey(
          id, username, display_name, avatar_url, created_at
        ),
        recipient:profiles!notifications_user_id_fkey(
          id, username, display_name, avatar_url, created_at
        ),
        room:rooms!notifications_room_id_fkey(
          id, name, created_at, created_by, is_private
        )
      `
      )
      .eq("id", notificationId)
      .limit(1);

    const result = await queryPromise;

    return SafeSupabaseQuery.array<NotificationWithRelations>(
      Promise.resolve({
        data: result.data as NotificationWithRelations[] | null,
        error: result.error,
      })
    );
  } catch (error) {
    console.error("Error in safeFetchSingleNotification:", error);
    return { data: [], error };
  }
};

export const useEnhancedNotification = create<EnhancedNotificationState>((set, get) => {
  const supabase = getSupabaseBrowserClient();

  return {
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    hasError: false,
    lastFetch: null,
    subscriptionActive: false,
    connectionHealth: 'healthy',
    lastSuccessfulFetch: null,

    setNotifications: (notifications) => {
      const unreadCount = notifications.filter(
        (n) => n.status === "unread"
      ).length;
      set({ notifications, unreadCount });
    },

    addNotification: (notification) => {
      const current = get().notifications;
      if (!current.some((n) => n.id === notification.id)) {
        const newNotifications = [notification, ...current];
        const unreadCount = newNotifications.filter(
          (n) => n.status === "unread"
        ).length;

        set({ notifications: newNotifications, unreadCount });

        if (["join_request", "room_invite"].includes(notification.type)) {
          toast.success("🔔 New notification!");
        }
      }
    },

    removeNotification: (id) => {
      const newNotifications = get().notifications.filter(
        (n) => n.id !== id
      );
      const unreadCount = newNotifications.filter(
        (n) => n.status === "unread"
      ).length;
      set({ notifications: newNotifications, unreadCount });
    },

    markAsRead: async (notificationId: string) => {
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ status: "read" })
          .eq("id", notificationId);

        if (error) throw error;

        set((state) => {
          const newNotifications = state.notifications.map((n) =>
            n.id === notificationId ? { ...n, status: "read" } : n
          );
          const unreadCount = newNotifications.filter(
            (n) => n.status === "unread"
          ).length;
          return { notifications: newNotifications, unreadCount };
        });

        toast.success("Notification marked as read");
      } catch (error) {
        console.error("❌ Mark as read error:", error);
        toast.error("Failed to mark notification as read");
      }
    },

    markAllAsRead: async (userId: string) => {
      if (!userId) {
        toast.error("User ID required to mark notifications as read");
        return;
      }

      try {
        const { error } = await supabase
          .from("notifications")
          .update({ status: "read" })
          .eq("user_id", userId)
          .eq("status", "unread");

        if (error) throw error;

        set((state) => {
          const newNotifications = state.notifications.map((n) => ({
            ...n,
            status: "read",
          }));
          return { notifications: newNotifications, unreadCount: 0 };
        });

        toast.success("All notifications marked as read");
      } catch (error) {
        console.error("❌ Mark all as read error:", error);
        toast.error("Failed to mark all notifications as read");
      }
    },

    fetchNotifications: async (userId: string) => {
      if (!userId) {
        console.error("❌ No userId provided to fetchNotifications");
        set({ hasError: true, isLoading: false });
        return;
      }

      try {
        set({ isLoading: true, hasError: false });

        const { data, error } = await safeFetchNotifications(userId);

        if (error) {
          console.error("❌ Notification fetch error:", error);
          get().setConnectionHealth('degraded');
          throw error;
        }

        const transformed = data.map(transformNotification);
        const unreadCount = transformed.filter(
          (n) => n.status === "unread"
        ).length;

        set({
          notifications: transformed,
          unreadCount,
          isLoading: false,
          lastFetch: Date.now(),
          lastSuccessfulFetch: Date.now(),
          hasError: false,
          connectionHealth: 'healthy',
        });
      } catch (error: any) {
        console.error("💥 Error fetching notifications:", error);
        set({ hasError: true, isLoading: false });
        get().setConnectionHealth('offline');

        if (error.code === "406" || error.message?.includes("406")) {
          toast.error("Failed to load notifications - please refresh");
        } else if (error.code === "PGRST116") {
          // Connection timeout
          toast.error("Connection timeout - retrying...");
          get().setConnectionHealth('degraded');
        } else {
          toast.error("Failed to load notifications");
        }
      }
    },

    subscribeToNotifications: (userId: string) => {
      if (!userId) {
        console.error("❌ No userId for subscription");
        return;
      }

      // Cleanup old channel
      if (notificationChannel) {
        supabase.removeChannel(notificationChannel);
        notificationChannel = null;
      }

      const channelName = `notifications-${userId}`;
      console.log("🔔 Setting up real-time subscription:", channelName);

      notificationChannel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          async (payload) => {
            try {
              get().setConnectionHealth('healthy');
              
              const { data: newNotifications, error } =
                await safeFetchSingleNotification(payload.new.id);

              if (error) {
                console.error("❌ Error fetching new notification details:", error);
                get().setConnectionHealth('degraded');
                return;
              }

              if (newNotifications.length > 0) {
                const transformed = transformNotification(newNotifications[0]);
                get().addNotification(transformed);
              }
            } catch (error) {
              console.error("💥 Error processing real-time notification:", error);
              get().setConnectionHealth('degraded');
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            set((state) => {
              const existingIndex = state.notifications.findIndex(
                (n) => n.id === payload.new.id
              );
              if (existingIndex !== -1) {
                const newNotifications = [...state.notifications];
                newNotifications[existingIndex] = {
                  ...newNotifications[existingIndex],
                  ...payload.new,
                };
                const unreadCount = newNotifications.filter(
                  (n) => n.status === "unread"
                ).length;
                return { notifications: newNotifications, unreadCount };
              }
              return state;
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            get().removeNotification(payload.old.id);
          }
        )
        .on('system', { event: 'disconnect' }, () => {
          console.log('🔌 Realtime connection lost');
          get().setConnectionHealth('offline');
        })
        .on('system', { event: 'reconnect' }, () => {
          console.log('🔌 Realtime connection restored');
          get().setConnectionHealth('healthy');
          // Resubscribe to ensure we don't miss any notifications
          setTimeout(() => {
            get().fetchNotifications(userId);
          }, 1000);
        })
        .subscribe((status) => {
          console.log("📡 Notification subscription status:", status);
          set({ subscriptionActive: status === "SUBSCRIBED" });

          if (status === "SUBSCRIBED") {
            get().setConnectionHealth('healthy');
            subscriptionRetryCount = 0;
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error("Notification channel error");
            get().setConnectionHealth('offline');

            if (subscriptionRetryCount < MAX_RETRY_ATTEMPTS) {
              subscriptionRetryCount++;
              setTimeout(() => {
                if (get().connectionHealth === 'offline') {
                  get().subscribeToNotifications(userId);
                }
              }, 2000 * subscriptionRetryCount);
            } else {
              console.error("Max retry attempts reached for notification subscription");
            }
          }
        });
    },

    unsubscribeFromNotifications: () => {
      if (notificationChannel) {
        supabase.removeChannel(notificationChannel);
        notificationChannel = null;
        set({ subscriptionActive: false });
        subscriptionRetryCount = 0;
        console.log("🧹 Unsubscribed from notifications");
      }
    },

    clearError: () => set({ hasError: false }),

    retrySubscription: (userId: string) => {
      subscriptionRetryCount = 0;
      get().unsubscribeFromNotifications();
      setTimeout(() => {
        get().subscribeToNotifications(userId);
      }, 500);
    },

    setConnectionHealth: (health) => set({ connectionHealth: health }),

    setLastSuccessfulFetch: (timestamp) => set({ lastSuccessfulFetch: timestamp }),
  };
});

// Hook for using notifications with auto-cleanup
export const useNotificationSubscription = (userId: string | null) => {
  const {
    subscribeToNotifications,
    unsubscribeFromNotifications,
    fetchNotifications,
  } = useEnhancedNotification();

  // Use useEffect for subscription management
  React.useEffect(() => {
    if (!userId) return;

    // Initial fetch
    fetchNotifications(userId);

    // Subscribe realtime
    subscribeToNotifications(userId);

    return () => {
      unsubscribeFromNotifications();
    };
  }, [userId, fetchNotifications, subscribeToNotifications, unsubscribeFromNotifications]);

  return {};
};

// Enhanced hook with connection management
export const useEnhancedNotificationSubscription = (userId: string | null) => {
  const {
    subscribeToNotifications,
    unsubscribeFromNotifications,
    fetchNotifications,
    connectionHealth,
    retrySubscription,
  } = useEnhancedNotification();

  React.useEffect(() => {
    if (!userId) return;

    const initializeNotifications = async () => {
      try {
        await fetchNotifications(userId);
        subscribeToNotifications(userId);
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      }
    };

    initializeNotifications();

    return () => {
      unsubscribeFromNotifications();
    };
  }, [userId, fetchNotifications, subscribeToNotifications, unsubscribeFromNotifications]);

  // Auto-retry when connection is lost
  React.useEffect(() => {
    if (connectionHealth === 'offline' && userId) {
      const retryTimer = setTimeout(() => {
        retrySubscription(userId);
      }, 5000);

      return () => clearTimeout(retryTimer);
    }
  }, [connectionHealth, userId, retrySubscription]);

  return { connectionHealth };
};

// Utility function to check if notification service is healthy
export const checkNotificationHealth = async (): Promise<boolean> => {
  try {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const { error } = await supabase
      .from("notifications")
      .select("id")
      .limit(1)
      .maybeSingle();

    return !error;
  } catch (error) {
    console.error("Notification health check failed:", error);
    return false;
  }
};

// Smart cache management hook
export const useNotificationCache = (userId: string | null) => {
  const {
    notifications,
    lastFetch,
    lastSuccessfulFetch,
    fetchNotifications,
    connectionHealth,
  } = useEnhancedNotification();

  React.useEffect(() => {
    if (!userId) return;

    const now = Date.now();
    const shouldRefresh = !lastFetch || (now - lastFetch > CACHE_TTL);
    const hasStaleData = lastSuccessfulFetch && (now - lastSuccessfulFetch <= STALE_TTL);

    if (shouldRefresh && connectionHealth === 'healthy') {
      if (hasStaleData && notifications.length > 0) {
        // Background refresh with stale data
        fetchNotifications(userId);
      } else {
        // Immediate refresh needed
        fetchNotifications(userId);
      }
    }
  }, [userId, lastFetch, lastSuccessfulFetch, notifications.length, fetchNotifications, connectionHealth]);

  return { shouldUseCache: !!lastSuccessfulFetch && (Date.now() - lastSuccessfulFetch <= STALE_TTL) };
};

// Performance-optimized selectors
export const useUnreadNotifications = () => 
  useEnhancedNotification((state) => 
    state.notifications.filter(n => n.status === 'unread')
  );

export const useNotificationCounts = () => 
  useEnhancedNotification((state) => ({
    total: state.notifications.length,
    unread: state.unreadCount,
    hasUnread: state.unreadCount > 0,
  }));

export const useNotificationByType = (type: string) =>
  useEnhancedNotification((state) =>
    state.notifications.filter(n => n.type === type)
  );

// Import React for hooks

// Export the main store as useNotification for backward compatibility
export const useNotification = useEnhancedNotification;