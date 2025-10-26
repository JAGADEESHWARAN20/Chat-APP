// lib/store/notifications.ts
import { create } from "zustand";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";

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

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

type NotificationWithRelations = NotificationRow & {
  sender: ProfileType | null;
  recipient: ProfileType | null;
  room: RoomType | null;
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

interface NotificationState {
  notifications: Inotification[];
  setNotifications: (notifications: Inotification[]) => void;
  addNotification: (notification: Inotification) => void;
  markAsRead: (notificationId: string) => Promise<void>;
  removeNotification: (notificationId: string) => void;
  fetchNotifications: (userId: string) => Promise<void>;
  subscribeToNotifications: (userId: string) => void;
  unsubscribeFromNotifications: () => void;
}

export const useNotification = create<NotificationState>((set, get) => {
  const supabase = supabaseBrowser();
  let notificationChannel: ReturnType<typeof supabase.channel> | null = null;

  const transformNotification = (n: NotificationWithRelations): Inotification => ({
    id: n.id,
    message: n.message,
    created_at: n.created_at,
    status: n.status,
    type: n.type,
    sender_id: n.sender_id,
    user_id: n.user_id,
    room_id: n.room_id,
    join_status: n.join_status,
    direct_chat_id: n.direct_chat_id,
    users: n.sender,
    recipient: n.recipient,
    rooms: n.room,
  });

  return {
    notifications: [],

    setNotifications: (notifications) => set({ notifications }),

    addNotification: (notification) => {
      const current = get().notifications;
      if (!current.some((n) => n.id === notification.id)) {
        set({ notifications: [notification, ...current] });
      }
    },

    removeNotification: (id) => {
      set({
        notifications: get().notifications.filter((n) => n.id !== id),
      });
    },

    markAsRead: async (notificationId: string) => {
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ status: "read" })
          .eq("id", notificationId);

        if (error) throw error;

        set({
          notifications: get().notifications.map((n) =>
            n.id === notificationId ? { ...n, status: "read" } : n
          ),
        });
      } catch (error) {
        console.error("Mark as read error:", error);
        toast.error("Failed to mark notification as read");
      }
    },

    fetchNotifications: async (userId: string) => {
      try {
        console.log("🔔 Fetching notifications for user:", userId);

        // Use a single query with proper joins
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

        console.log("✅ Notifications fetched:", data?.length || 0);

        if (!data || data.length === 0) {
          console.log("ℹ️ No notifications found for user");
          set({ notifications: [] });
          return;
        }

        const transformed = data.map(transformNotification);
        set({ notifications: transformed });
        
      } catch (error: any) {
        console.error("💥 Error fetching notifications:", error);
        toast.error("Failed to load notifications");
      }
    },

    subscribeToNotifications: (userId: string) => {
      console.log("🔔 Setting up real-time subscription for user:", userId);
      
      notificationChannel?.unsubscribe();

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
              // Fetch the complete notification with relations
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
                
                set((state) => {
                  // Avoid duplicates
                  if (!state.notifications.some((n) => n.id === transformed.id)) {
                    return {
                      notifications: [transformed, ...state.notifications],
                    };
                  }
                  return state;
                });

                toast.success("🔔 New notification!");
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
          (payload) => {
            console.log("🔄 Notification updated:", payload);
            
            set((state) => ({
              notifications: state.notifications.map((n) =>
                n.id === payload.new.id ? { ...n, ...payload.new } : n
              ),
            }));
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
            console.log("🗑️ Notification deleted:", payload);
            
            set((state) => ({
              notifications: state.notifications.filter((n) => n.id !== payload.old.id),
            }));
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
  };
});