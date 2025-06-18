import { create } from "zustand";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";
import { transformNotification } from "@/lib/utils/notifications";

type User = Database["public"]["Tables"]["users"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RawNotification = Database["public"]["Tables"]["notifications"]["Row"];

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
  users: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
    created_at: string;
  } | null;
  recipient: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
    created_at: string;
  } | null;
  rooms: {
    id: string;
    name: string;
    created_at: string;
    created_by: string | null;
    is_private: boolean;
  } | null;
}

interface NotificationState {
  notifications: Inotification[];
  setNotifications: (notifications: Inotification[]) => void;
  addNotification: (notification: Inotification) => void;
  markAsRead: (notificationId: string) => void;
  fetchNotifications: (userId: string, page?: number, limit?: number, retries?: number) => Promise<void>;
  subscribeToNotifications: (userId: string) => void;
  unsubscribeFromNotifications: () => void;
}

export const useNotification = create<NotificationState>((set, get) => {
  const supabase = supabaseBrowser();
  const usersCache = new Map<string, User>();
  let notificationChannel: ReturnType<typeof supabase.channel> | null = null;

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const fetchUserData = async (userId: string): Promise<User | null> => {
    if (usersCache.has(userId)) {
      return usersCache.get(userId)!;
    }

    const { data, error } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, created_at")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn(`[Notifications Store] Failed to fetch user ${userId}:`, error.message);
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
        notifications: [notification, ...state.notifications].slice(0, 20),
      })),

    markAsRead: async (notificationId) => {
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ status: "read" })
          .eq("id", notificationId);

        if (error) throw error;

        set((state) => ({
          notifications: state.notifications.map((notif) =>
            notif.id === notificationId ? { ...notif, status: "read" } : notif
          ),
        }));
      } catch (error) {
        console.error("Error marking notification as read:", error);
        toast.error("Failed to mark notification as read");
      }
    },

    fetchNotifications: async (userId, page = 1, limit = 20, retries = 3) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const { data: notifications, error } = await supabase
            .from("notifications")
            .select(`
              *,
              users:users!sender_id (
                id,
                username,
                display_name,
                avatar_url,
                created_at
              ),
              recipient:users!user_id (
                id,
                username,
                display_name,
                avatar_url,
                created_at
              ),
              rooms:rooms!room_id (
                id,
                name,
                created_at,
                created_by,
                is_private
              )
            `)
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

          if (error) throw error;

          set({ notifications: notifications || [] });
          return;
        } catch (error) {
          console.error(`[Notifications Store] Fetch attempt ${attempt} failed:`, error);
          if (attempt === retries) {
            toast.error("Failed to load notifications");
            return;
          }
          await delay(1000 * attempt);
        }
      }
    },

    subscribeToNotifications: (userId) => {
      // Clean up existing subscription if any
      if (notificationChannel) {
        notificationChannel.unsubscribe();
      }

      // Create a new real-time subscription
      notificationChannel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          async (payload) => {
            if (payload.eventType === "INSERT") {
              const newNotification = payload.new as RawNotification;

              // Fetch complete notification data with related records
              const { data: fullNotification, error } = await supabase
                .from("notifications")
                .select(`
                  *,
                  users:users!sender_id (
                    id,
                    username,
                    display_name,
                    avatar_url,
                    created_at
                  ),
                  recipient:users!user_id (
                    id,
                    username,
                    display_name,
                    avatar_url,
                    created_at
                  ),
                  rooms:rooms!room_id (
                    id,
                    name,
                    created_at,
                    created_by,
                    is_private
                  )
                `)
                .eq("id", newNotification.id)
                .single();

              if (error) {
                console.error("Error fetching full notification:", error);
                return;
              }

              if (fullNotification) {
                get().addNotification(fullNotification as Inotification);

                // Show toast notification
                const message =
                  fullNotification.type === "message"
                    ? `New message in ${fullNotification.rooms?.name || "a room"}`
                    : fullNotification.message;

                toast(message, {
                  description: fullNotification.users?.display_name || "Someone",
                  action: {
                    label: "View",
                    onClick: () => {
                      // Handle notification click if needed
                    },
                  },
                });
              }
            } else if (payload.eventType === "UPDATE") {
              const updatedNotification = payload.new as RawNotification;
              set((state) => ({
                notifications: state.notifications.map((notif) =>
                  notif.id === updatedNotification.id ? { ...notif, ...updatedNotification } : notif
                ),
              }));
            } else if (payload.eventType === "DELETE") {
              const deletedNotification = payload.old as RawNotification;
              set((state) => ({
                notifications: state.notifications.filter(
                  (notif) => notif.id !== deletedNotification.id
                ),
              }));
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("Subscribed to notifications");
          }
        });
    },

    unsubscribeFromNotifications: () => {
      if (notificationChannel) {
        notificationChannel.unsubscribe();
        notificationChannel = null;
      }
    },
  };
});