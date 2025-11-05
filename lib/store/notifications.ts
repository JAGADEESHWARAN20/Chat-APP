// lib/store/notifications.ts
import { create } from "zustand";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import { SafeSupabaseQuery } from "@/lib/utils/supabase-queries";
import { useEffect } from "react";

// ---- Types ----
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

const normalizeNotificationType = (dbType: string): string => {
  const typeMap: Record<string, string> = {
    'join_request': 'join_request',
    'new_message': 'message',
    'room_switch': 'room_invite',
    'user_joined': 'user_joined',
    'join_request_rejected': 'join_request_rejected',
    'join_request_accepted': 'join_request_accepted',
    'notification_unread': 'notification_unread',
    'room_left': 'room_left',
  };
  
  return typeMap[dbType] || dbType;
};

// FIXED: Properly typed transform function
const transformNotification = (notif: NotificationWithRelations): Inotification => {
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

interface NotificationState {
  notifications: Inotification[];
  unreadCount: number;
  isLoading: boolean;
  hasError: boolean;
  lastFetch: number | null;
  subscriptionActive: boolean;
  
  setNotifications: (notifications: Inotification[]) => void;
  addNotification: (notification: Inotification) => void;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>; // FIXED: Added userId parameter
  removeNotification: (notificationId: string) => void;
  fetchNotifications: (userId: string) => Promise<void>;
  subscribeToNotifications: (userId: string) => void;
  unsubscribeFromNotifications: () => void;
  clearError: () => void;
  retrySubscription: (userId: string) => void;
}

let notificationChannel: RealtimeChannel | null = null;
let subscriptionRetryCount = 0;
const MAX_RETRY_ATTEMPTS = 3;

export const useNotification = create<NotificationState>((set, get) => {
  const supabase = getSupabaseBrowserClient();

  // FIXED: Proper async wrapper for Supabase queries
  const safeFetchNotifications = async (userId: string) => {
    try {
      const queryPromise = supabase
        .from("notifications")
        .select(`
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
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      // FIXED: Properly await the query and pass to SafeSupabaseQuery
      const result = await queryPromise;
      return SafeSupabaseQuery.array<NotificationWithRelations>(
        Promise.resolve({ data: result.data as NotificationWithRelations[] | null, error: result.error })
      );
    } catch (error) {
      console.error("Error in safeFetchNotifications:", error);
      return { data: [], error };
    }
  };

  // FIXED: Proper async wrapper for single notification
  const safeFetchSingleNotification = async (notificationId: string) => {
    try {
      const queryPromise = supabase
        .from("notifications")
        .select(`
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
        `)
        .eq("id", notificationId)
        .limit(1);

      // FIXED: Properly await the query and pass to SafeSupabaseQuery
      const result = await queryPromise;
      return SafeSupabaseQuery.array<NotificationWithRelations>(
        Promise.resolve({ data: result.data as NotificationWithRelations[] | null, error: result.error })
      );
    } catch (error) {
      console.error("Error in safeFetchSingleNotification:", error);
      return { data: [], error };
    }
  };

  return {
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    hasError: false,
    lastFetch: null,
    subscriptionActive: false,

    setNotifications: (notifications) => {
      console.log("📝 Setting notifications:", notifications.length);
      const unreadCount = notifications.filter(n => n.status === 'unread').length;
      set({ notifications, unreadCount });
    },

    addNotification: (notification) => {
      const current = get().notifications;
      if (!current.some((n) => n.id === notification.id)) {
        const newNotifications = [notification, ...current];
        const unreadCount = newNotifications.filter(n => n.status === 'unread').length;
        set({ notifications: newNotifications, unreadCount }); // 🏪 Update store
        
        // 🔔 Show toast for important notifications
        if (['join_request', 'room_invite'].includes(notification.type)) {
          toast.success("🔔 New notification!");
        }
      }
    },

    removeNotification: (id) => {
      console.log("🗑️ Removing notification:", id);
      const newNotifications = get().notifications.filter((n) => n.id !== id);
      const unreadCount = newNotifications.filter(n => n.status === 'unread').length;
      set({ notifications: newNotifications, unreadCount });
    },

    markAsRead: async (notificationId: string) => {
      try {
        console.log("✅ Marking as read:", notificationId);
        
        const { error } = await supabase
          .from("notifications")
          .update({ status: "read" })
          .eq("id", notificationId);

        if (error) throw error;

        set(state => {
          const newNotifications = state.notifications.map((n) =>
            n.id === notificationId ? { ...n, status: "read" } : n
          );
          const unreadCount = newNotifications.filter(n => n.status === 'unread').length;
          return { notifications: newNotifications, unreadCount };
        });

        toast.success("Notification marked as read");
      } catch (error) {
        console.error("❌ Mark as read error:", error);
        toast.error("Failed to mark notification as read");
      }
    },

    // FIXED: markAllAsRead with proper userId parameter
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

        set(state => {
          const newNotifications = state.notifications.map((n) => ({
            ...n,
            status: "read"
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
        console.log("🔄 Fetching notifications for user:", userId);

        const { data, error } = await safeFetchNotifications(userId);

        if (error) {
          console.error("❌ Notification fetch error:", error);
          throw error;
        }

        console.log("✅ Raw notifications fetched:", data.length);
        
        // FIXED: Properly typed transformation
        const transformed = data.map(transformNotification);
        const unreadCount = transformed.filter(n => n.status === 'unread').length;
        
        console.log("✅ Transformed notifications:", transformed.length);
        console.log("📊 Unread count:", unreadCount);
        
        set({ 
          notifications: transformed, 
          unreadCount,
          isLoading: false,
          lastFetch: Date.now(),
          hasError: false
        });
        
      } catch (error: any) {
        console.error("💥 Error fetching notifications:", error);
        set({ hasError: true, isLoading: false });
        
        if (error.code === '406' || error.message?.includes('406')) {
          console.warn("Content negotiation issue - handled by SafeSupabaseQuery");
          toast.error("Failed to load notifications - please refresh");
        } else if (error.code === 'PGRST301' || error.message?.includes('relation')) {
          console.error("Database relation error - check RLS policies");
          toast.error("Permission error - please check database setup");
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

      // Clean up existing subscription
      if (notificationChannel) {
        supabase.removeChannel(notificationChannel);
        notificationChannel = null;
      }

      console.log("🔔 Setting up real-time subscription for user:", userId);
      
      notificationChannel = supabase
        .channel(`notifications-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          async (payload) => {
            console.log("🎯 Real-time notification INSERT:", payload);

            try {
              const { data: newNotifications, error } = await safeFetchSingleNotification(payload.new.id);

              if (error) {
                console.error("❌ Error fetching new notification details:", error);
                return;
              }

              if (newNotifications.length > 0) {
                const transformed = transformNotification(newNotifications[0]);
                get().addNotification(transformed);
                
                // Auto-refetch to ensure consistency
                setTimeout(() => {
                  get().fetchNotifications(userId);
                }, 1000);
              }
            } catch (error) {
              console.error("💥 Error processing real-time notification:", error);
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
          async (payload) => {
            console.log("🔄 Real-time notification UPDATE:", payload);
            
            // Update existing notification in state
            set(state => {
              const existingIndex = state.notifications.findIndex(n => n.id === payload.new.id);
              if (existingIndex !== -1) {
                const newNotifications = [...state.notifications];
                newNotifications[existingIndex] = {
                  ...newNotifications[existingIndex],
                  ...payload.new
                };
                const unreadCount = newNotifications.filter(n => n.status === 'unread').length;
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
            console.log("🗑️ Real-time notification DELETE:", payload);
            get().removeNotification(payload.old.id);
          }
        )
        .subscribe((status) => {
          console.log("📡 Notification subscription status:", status);
          set({ subscriptionActive: status === 'SUBSCRIBED' });
          
          if (status === 'CHANNEL_ERROR') {
            console.error('Notification channel error');
            set({ subscriptionActive: false });
            
            if (subscriptionRetryCount < MAX_RETRY_ATTEMPTS) {
              subscriptionRetryCount++;
              console.log(`🔄 Retrying subscription (attempt ${subscriptionRetryCount})...`);
              setTimeout(() => {
                get().subscribeToNotifications(userId);
              }, 2000 * subscriptionRetryCount);
            } else {
              console.error('Max retry attempts reached for notification subscription');
              toast.error("Real-time notifications unavailable");
            }
          } else if (status === 'SUBSCRIBED') {
            subscriptionRetryCount = 0; // Reset on successful subscription
            console.log('✅ Notification subscription active');
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
      console.log("🔄 Manual subscription retry requested");
      subscriptionRetryCount = 0;
      get().unsubscribeFromNotifications();
      setTimeout(() => {
        get().subscribeToNotifications(userId);
      }, 500);
    }
  };
});

// Hook for using notifications with auto-cleanup
export const useNotificationSubscription = (userId: string | null) => {
  const {
    subscribeToNotifications,
    unsubscribeFromNotifications,
    fetchNotifications,
    subscriptionActive
  } = useNotification();

  useEffect(() => {
    if (!userId) return;

    // Fetch initial notifications
    fetchNotifications(userId);
    
    // Subscribe to real-time updates
    subscribeToNotifications(userId);

    // Cleanup on unmount or userId change
    return () => {
      unsubscribeFromNotifications();
    };
  }, [userId, fetchNotifications, subscribeToNotifications, unsubscribeFromNotifications]);

  return { subscriptionActive };
};

// Utility function to check if notification service is healthy
export const checkNotificationHealth = async (): Promise<boolean> => {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return false;

    const { error } = await supabase
      .from('notifications')
      .select('id')
      .limit(1)
      .maybeSingle();

    return !error;
  } catch (error) {
    console.error('Notification health check failed:', error);
    return false;
  }
};