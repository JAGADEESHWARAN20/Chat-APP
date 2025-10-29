// lib/store/notifications.ts
import { create } from "zustand";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

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

const transformNotification = (
  notif: RawNotification & {
    sender?: any;
    recipient?: any;
    room?: any;
  }
): Inotification => {
  const users = Array.isArray(notif.sender)
    ? notif.sender[0] || null
    : notif.sender || null;

  const recipient = Array.isArray(notif.recipient)
    ? notif.recipient[0] || null
    : notif.recipient || null;

  const rooms = Array.isArray(notif.room)
    ? notif.room[0] || null
    : notif.room || null;

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
  
  setNotifications: (notifications: Inotification[]) => void;
  addNotification: (notification: Inotification) => void;
  markAsRead: (notificationId: string) => Promise<void>;
  removeNotification: (notificationId: string) => void;
  fetchNotifications: (userId: string) => Promise<void>;
  subscribeToNotifications: (userId: string) => void;
  unsubscribeFromNotifications: () => void;
  clearError: () => void;
}

let notificationChannel: RealtimeChannel | null = null;

export const useNotification = create<NotificationState>((set, get) => {
  const supabase = supabaseBrowser();

  return {
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    hasError: false,
    lastFetch: null,

    setNotifications: (notifications) => {
      console.log("📝 Setting notifications:", notifications.length);
      const unreadCount = notifications.filter(n => n.status === 'unread').length;
      set({ notifications, unreadCount });
    },

    addNotification: (notification) => {
      const current = get().notifications;
      if (!current.some((n) => n.id === notification.id)) {
        console.log("➕ Adding new notification:", notification.id);
        const newNotifications = [notification, ...current];
        const unreadCount = newNotifications.filter(n => n.status === 'unread').length;
        set({ notifications: newNotifications, unreadCount });
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
      } catch (error) {
        console.error("❌ Mark as read error:", error);
        toast.error("Failed to mark notification as read");
      }
    },

    fetchNotifications: async (userId: string) => {
      if (!userId) {
        console.error("❌ No userId provided to fetchNotifications");
        return;
      }

      try {
        set({ isLoading: true, hasError: false });
        console.log("🔄 Fetching notifications for user:", userId);

        const { data, error } = await supabase
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

        if (error) {
          console.error("❌ Notification fetch error:", error);
          throw error;
        }

        console.log("✅ Raw notifications fetched:", data?.length || 0);
        console.log("📦 Sample notification:", data?.[0]);

        const transformed = (data || []).map(transformNotification);
        const unreadCount = transformed.filter(n => n.status === 'unread').length;
        
        console.log("✅ Transformed notifications:", transformed.length);
        console.log("📊 Unread count:", unreadCount);
        
        set({ 
          notifications: transformed, 
          unreadCount,
          isLoading: false,
          lastFetch: Date.now()
        });
        
      } catch (error: any) {
        console.error("💥 Error fetching notifications:", error);
        set({ hasError: true, isLoading: false });
        
        if (error.code === '406' || error.message?.includes('406')) {
          toast.error("Permission denied - please check RLS policies");
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

      console.log("🔔 Setting up real-time subscription for user:", userId);
      
      // Unsubscribe from existing channel
      if (notificationChannel) {
        supabase.removeChannel(notificationChannel);
        notificationChannel = null;
      }

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
            console.log("🎯 Real-time notification received:", payload);

            try {
              const { data: newNotification, error } = await supabase
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
                .eq("id", payload.new.id)
                .single();

              if (error) {
                console.error("❌ Error fetching new notification details:", error);
                return;
              }

              if (newNotification) {
                const transformed = transformNotification(newNotification);
                get().addNotification(transformed);
                toast.success("🔔 New notification!");
              }
            } catch (error) {
              console.error("💥 Error processing real-time notification:", error);
            }
          }
        )
        .subscribe((status) => {
          console.log("📡 Subscription status:", status);
        });
    },

    unsubscribeFromNotifications: () => {
      if (notificationChannel) {
        supabase.removeChannel(notificationChannel);
        notificationChannel = null;
        console.log("🧹 Unsubscribed from notifications");
      }
    },

    clearError: () => set({ hasError: false })
  };
});