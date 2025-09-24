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
  users: ProfileType | null;    // sender (kept name for UI compatibility)
  recipient: ProfileType | null;
  rooms: RoomType | null;    // room
}

interface NotificationState {
  notifications: Inotification[];
  setNotifications: (notifications: Inotification[]) => void;
  addNotification: (notification: Inotification) => void;
  markAsRead: (notificationId: string) => Promise<void>;
  removeNotification: (notificationId: string) => void;
  fetchNotifications: (
    userId: string,
    page?: number,
    limit?: number,
    retries?: number
  ) => Promise<void>;
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
      const { error } = await supabase
        .from("notifications")
        .update({ status: "read" })
        .eq("id", notificationId);
      if (error) {
        console.error("Mark as read error:", error);
        toast.error("Failed to mark notification as read");
      } else {
        set({
          notifications: get().notifications.map((n) =>
            n.id === notificationId ? { ...n, status: "read" } : n
          ),
        });
      }
    },

    fetchNotifications: async (userId, page = 1, limit = 20, retries = 3) => {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select(
            `
            *,
            sender:profiles!notifications_sender_id_fkey(id, username, display_name, avatar_url, created_at),
            recipient:profiles!notifications_user_id_fkey(id, username, display_name, avatar_url, created_at),
            room:rooms(*)
          `
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (error) throw error;

        const transformed = (data as NotificationWithRelations[]).map(transformNotification);
        console.log("Fetched notifications:", transformed.length, transformed); // Debug log
        set({ notifications: transformed });
      } catch (err) {
        console.error("Error fetching notifications:", err);
        if (retries > 0) {
          setTimeout(
            () => get().fetchNotifications(userId, page, limit, retries - 1),
            1000
          );
        } else {
          toast.error("Failed to fetch notifications after retries.");
        }
      }
    },

    subscribeToNotifications: (userId: string) => {
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
          (payload) => {
            const newNotif = payload.new as NotificationWithRelations;
            const transformed = transformNotification(newNotif);
            console.log("New realtime notification:", transformed); // Debug log
            set((state) => ({
              notifications: [transformed, ...state.notifications],
            }));
            toast("🔔 New notification received");
          }
        )
        .subscribe((status) => {
          console.log("Subscription status:", status); // Debug log
        });
    },

    unsubscribeFromNotifications: () => {
      if (notificationChannel) {
        supabase.removeChannel(notificationChannel);
        notificationChannel = null;
      }
    },
  };
});
