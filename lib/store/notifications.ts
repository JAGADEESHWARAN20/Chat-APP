import { create } from "zustand";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";

type UserType = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  created_at: string;
};

type RoomType = {
  id: string;
  name: string;
  created_at: string;
  created_by: string | null;
  is_private: boolean;
};

type NotificationWithRelations = Database["public"]["Tables"]["notifications"]["Row"] & {
  sender: UserType | null;
  recipient: UserType | null;
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
  users: UserType | null; // This maps to 'sender'
  recipient: UserType | null;
  rooms: RoomType | null; // This maps to 'room'
}

interface NotificationState {
  notifications: Inotification[];
  setNotifications: (notifications: Inotification[]) => void;
  addNotification: (notification: Inotification) => void;
  markAsRead: (notificationId: string) => Promise<void>;
  // Add removeNotification to the interface
  removeNotification: (notificationId: string) => void;
  fetchNotifications: (userId: string, page?: number, limit?: number, retries?: number) => Promise<void>;
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
    users: n.sender, // Correct mapping from 'sender' alias to 'users' in Inotification
    recipient: n.recipient,
    rooms: n.room // Correct mapping from 'room' alias to 'rooms' in Inotification
  });

  return {
    notifications: [],
    setNotifications: (notifications) => set({ notifications }),
    addNotification: (notification) => {
      const notifications = get().notifications;
      const exists = notifications.some(n => n.id === notification.id);
      if (!exists) {
        set({ notifications: [notification, ...notifications] });
      }
    },

    markAsRead: async (notificationId) => {
      try {
        console.log("[Notifications Store] Marking notification as read:", notificationId);
        const { error } = await supabase
          .from("notifications")
          .update({ status: "read" })
          .eq("id", notificationId);

        if (error) throw error;

        // Update the status in the local state
        const notifications = get().notifications.map(n =>
          n.id === notificationId ? { ...n, status: "read" } : n
        );
        set({ notifications });

        console.log("[Notifications Store] Successfully marked as read");
      } catch (error) {
        console.error("[Notifications Store] Error marking as read:", error);
        toast.error("Failed to update notification");
      }
    },

    // Implementation for removeNotification
    removeNotification: (notificationId) => {
      console.log("[Notifications Store] Removing notification from state:", notificationId);
      set((state) => ({
        notifications: state.notifications.filter(n => n.id !== notificationId)
      }));
      console.log("[Notifications Store] Notification removed from state");
    },

    fetchNotifications: async (userId: string, page = 1, limit = 50, retries = 3) => {
      try {
        console.log("[Notifications Store] Fetching notifications for user:", userId);

        const { data, error } = await supabase
          .from("notifications")
          .select(`
            *,
            sender:users!notifications_sender_id_fkey(
              id, username, display_name, avatar_url, created_at
            ),
            recipient:users!notifications_user_id_fkey(
              id, username, display_name, avatar_url, created_at
            ),
            room:rooms(
              id, name, created_at, created_by, is_private
            )
          `)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (error) throw error;

        if (data) {
          console.log("[Notifications Store] Successfully fetched notifications:", data.length);
          const transformedNotifications = data.map(transformNotification);
          set({ notifications: transformedNotifications });
          console.log("[Notifications Store] Notifications transformed and set in state");
        }
      } catch (error) {
        console.error("[Notifications Store] Error fetching notifications:", error);
        if (retries > 0) {
          console.log("[Notifications Store] Retrying fetch... Attempts remaining:", retries - 1);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return get().fetchNotifications(userId, page, limit, retries - 1);
        }
        toast.error("Failed to fetch notifications");
      }
    },

    subscribeToNotifications: (userId) => {
      try {
        console.log("[Notifications Store] Setting up notification subscription for user:", userId);

        if (notificationChannel) {
          console.log("[Notifications Store] Cleaning up existing subscription");
          notificationChannel.unsubscribe();
        }

        notificationChannel = supabase.channel(`notifications:${userId}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${userId}`
            },
            async (payload) => {
              console.log("[Notifications Store] Received notification change:", payload);
              // Instead of refetching all, you can optimize based on payload.eventType
              // For simplicity and to ensure data consistency, we'll refetch for now.
              await get().fetchNotifications(userId);
            }
          )
          .subscribe((status) => {
            console.log("[Notifications Store] Subscription status:", status);
          });
      } catch (error) {
        console.error("[Notifications Store] Error setting up subscription:", error);
        toast.error("Failed to subscribe to notifications");
      }
    },

    unsubscribeFromNotifications: () => {
      if (notificationChannel) {
        console.log("[Notifications Store] Unsubscribing from notifications");
        notificationChannel.unsubscribe();
        notificationChannel = null;
      }
    },
  };
});