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
  user_id: string;
  room_id: string | null;
  users: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null; // Sender user
  recipient: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null; // Recipient user (user_id)
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
  user_id: string;
  room_id: string | null;
  users: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  recipient: {
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
  fetchNotifications: (userId: string, page?: number, limit?: number, retries?: number) => Promise<void>;
  subscribeToNotifications: (userId: string, callback?: () => void) => () => void;
}

export const useNotification = create<NotificationState>((set) => {
  const supabase = supabaseBrowser();

  // Cache for users data to reduce API calls
  const usersCache = new Map<string, any>();

  // Utility function to delay retries
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Utility function to fetch user data with caching
  const fetchUserData = async (userId: string) => {
    if (usersCache.has(userId)) {
      return usersCache.get(userId);
    }

    const { data, error } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn(`Failed to fetch user ${userId}:`, error.message);
      return null;
    }

    usersCache.set(userId, data);
    return data;
  };

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

    fetchNotifications: async (userId, page = 1, limit = 20, retries = 3) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          // Attempt to fetch notifications with the users and recipient joins
          let query = supabase
            .from("notifications")
            .select(`
              id,
              message,
              created_at,
              status,
              type,
              sender_id,
              user_id,
              room_id,
              users!notifications_sender_id_fkey (id, username, display_name, avatar_url),
              recipient:users!notifications_user_id_fkey (id, username, display_name, avatar_url),
              rooms!notifications_room_id_fkey (id, name)
            `)
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

          let { data: notificationsData, error } = await query;

          if (error) {
            // Fallback if the join fails due to a relationship error
            if (error.message.includes("Could not find a relationship")) {
              console.warn("Falling back to fetch notifications without joins due to schema error.");
              const { data: fallbackData, error: fallbackError } = await supabase
                .from("notifications")
                .select(`
                  id,
                  message,
                  created_at,
                  status,
                  type,
                  sender_id,
                  user_id,
                  room_id
                `)
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .range((page - 1) * limit, page * limit - 1);

              if (fallbackError) {
                throw new Error(fallbackError.message || "Failed to fetch notifications (fallback)");
              }

              notificationsData = fallbackData;

              // Fetch users and rooms separately
              for (const notif of notificationsData) {
                // Fetch sender user data
                if (notif.sender_id) {
                  notif.users = await fetchUserData(notif.sender_id);
                } else {
                  notif.users = null;
                }

                // Fetch recipient user data
                if (notif.user_id) {
                  notif.recipient = await fetchUserData(notif.user_id);
                } else {
                  notif.recipient = null;
                }

                // Fetch room data
                if (notif.room_id) {
                  const { data: roomData, error: roomError } = await supabase
                    .from("rooms")
                    .select("id, name")
                    .eq("id", notif.room_id)
                    .single();

                  if (roomError) {
                    console.warn(`Failed to fetch room ${notif.room_id}:`, roomError.message);
                    notif.rooms = null;
                  } else {
                    notif.rooms = roomData;
                  }
                } else {
                  notif.rooms = null;
                }
              }
            } else {
              throw new Error(error.message || "Failed to fetch notifications");
            }
          }

          const formattedNotifications: Inotification[] = notificationsData.map((notif: any) => ({
            id: notif.id,
            content: notif.message,
            created_at: notif.created_at,
            is_read: notif.status === "read",
            type: notif.type,
            sender_id: notif.sender_id,
            user_id: notif.user_id,
            room_id: notif.room_id,
            users: notif.users
              ? {
                  id: notif.users.id,
                  username: notif.users.username,
                  display_name: notif.users.display_name,
                  avatar_url: notif.users.avatar_url,
                }
              : null,
            recipient: notif.recipient
              ? {
                  id: notif.recipient.id,
                  username: notif.recipient.username,
                  display_name: notif.recipient.display_name,
                  avatar_url: notif.recipient.avatar_url,
                }
              : null,
            rooms: notif.rooms ? { id: notif.rooms.id, name: notif.rooms.name } : null,
          }));

          set({ notifications: formattedNotifications });
          return; // Success, exit the retry loop
        } catch (error) {
          if (attempt === retries) {
            toast.error(error instanceof Error ? error.message : "Failed to fetch notifications");
            console.error(`Error fetching notifications (attempt ${attempt}/${retries}):`, error);
          } else {
            console.warn(`Retrying fetchNotifications (attempt ${attempt}/${retries})...`);
            await delay(1000 * attempt); // Exponential backoff: 1s, 2s, 3s
          }
        }
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
          async (payload: { new: NotificationPayload }) => {
            let data = payload.new;

            // Fetch users and rooms separately
            if (data.sender_id) {
              data.users = await fetchUserData(data.sender_id);
            } else {
              data.users = null;
            }

            if (data.user_id) {
              data.recipient = await fetchUserData(data.user_id);
            } else {
              data.recipient = null;
            }

            if (data.room_id) {
              const { data: roomData, error: roomError } = await supabase
                .from("rooms")
                .select("id, name")
                .eq("id", data.room_id)
                .single();

              if (roomError) {
                console.warn(`Failed to fetch room ${data.room_id}:`, roomError.message);
                data.rooms = null;
              } else {
                data.rooms = roomData;
              }
            } else {
              data.rooms = null;
            }

            const formattedNotification: Inotification = {
              id: data.id,
              content: data.message,
              created_at: data.created_at,
              is_read: data.status === "read",
              type: data.type,
              sender_id: data.sender_id,
              user_id: data.user_id,
              room_id: data.room_id,
              users: data.users
                ? {
                    id: data.users.id,
                    username: data.users.username,
                    display_name: data.users.display_name,
                    avatar_url: data.users.avatar_url,
                  }
                : null,
              recipient: data.recipient
                ? {
                    id: data.recipient.id,
                    username: data.recipient.username,
                    display_name: data.recipient.display_name,
                    avatar_url: data.recipient.avatar_url,
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
