import { create } from "zustand";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";

export interface Inotification {
  id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  type: string;
  sender_id: string;
  room_id: string | null;
  users: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  rooms: {
    id: string;
    name: string;
  } | null;
}

type NotificationPayload = {
  id: string;
  message: string;
  created_at: string;
  status: string;
  type: string;
  sender_id: string;
  room_id: string | null;
  users: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  rooms: {
    id: string;
    name: string;
  } | null;
};

interface NotificationState {
  notifications: Inotification[];
  setNotifications: (notifications: Inotification[]) => void;
  addNotification: (notification: Inotification) => void;
  markAsRead: (notificationId: string) => void;
  fetchNotifications: (userId: string, page?: number, limit?: number) => Promise<void>;
  subscribeToNotifications: (userId: string, callback?: () => void) => () => void;
}

export const useNotification = create<NotificationState>((set) => {
  const supabase = supabaseBrowser();

  return {
    notifications: [],

    setNotifications: (notifications) => set({ notifications }),

    addNotification: (notification) =>
      set((state) => ({
        notifications: [notification, ...state.notifications],
      })),

    markAsRead: (notificationId) =>
      set((state) => ({
        notifications: state.notifications.map((notif) =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        ),
      })),

    fetchNotifications: async (userId, page = 1, limit = 20) => {
      try {
        const { data: notificationsData, error } = await supabase
          .from("notifications")
          .select(`
            id,
            message,
            created_at,
            status,
            type,
            sender_id,
            room_id,
            users!notifications_sender_id_fkey (id, username, display_name, avatar_url),
            rooms (id, name)
          `)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (error) {
          throw new Error(error.message || "Failed to fetch notifications");
        }

        const formattedNotifications: Inotification[] = notificationsData.map((notif: any) => ({
          id: notif.id,
          content: notif.message,
          created_at: notif.created_at,
          is_read: notif.status === "read",
          type: notif.type,
          sender_id: notif.sender_id,
          room_id: notif.room_id,
          users: notif.users
            ? {
                id: notif.users.id,
                username: notif.users.username,
                display_name: notif.users.display_name,
                avatar_url: notif.users.avatar_url,
              }
            : null,
          rooms: notif.rooms ? { id: notif.rooms.id, name: notif.rooms.name } : null,
        }));

        set({ notifications: formattedNotifications });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to fetch notifications");
        console.error("Error fetching notifications:", error);
      }
    },

    subscribeToNotifications: (userId: string, callback?: () => void) => {
      const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload: { new: NotificationPayload }) => {
            const data = payload.new;
            const formattedNotification: Inotification = {
              id: data.id,
              content: data.message,
              created_at: data.created_at,
              is_read: data.status === "read",
              type: data.type,
              sender_id: data.sender_id,
              room_id: data.room_id,
              users: data.users
                ? {
                    id: data.users.id,
                    username: data.users.username,
                    display_name: data.users.display_name,
                    avatar_url: data.users.avatar_url,
                  }
                : null,
              rooms: data.rooms ? { id: data.rooms.id, name: data.rooms.name } : null,
            };
            set((state) => ({
              notifications: [formattedNotification, ...state.notifications],
            }));
            callback?.();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
});
