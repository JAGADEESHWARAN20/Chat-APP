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
  content: string;
  created_at: string | null;
  is_read: boolean;
  type: string;
  sender_id: string;
  user_id: string;
  room_id: string | null;
  join_status?: string | null;
  users: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    created_at: string;
  } | null;
  recipient: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    created_at: string;
  } | null;
  rooms: {
    id: string;
    name: string;
    created_at: string;
    created_by: string;
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

export const useNotification = create<NotificationState>((set) => {
  const supabase = supabaseBrowser();
  const usersCache = new Map<string, User>();
  let channel: ReturnType<typeof supabase.channel> | null = null;

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
        notifications: [notification, ...state.notifications].slice(0, 20),
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
          // Main query with joins
          const query = supabase
            .from("notifications")
            .select(
              `
              id,
              message,
              created_at,
              status,
              type,
              sender_id,
              user_id,
              room_id,
              join_status,
              users:users!notifications_sender_id_fkey(id, username, display_name, avatar_url, created_at),
              recipient:users!notifications_user_id_fkey(id, username, display_name, avatar_url, created_at),
              rooms:rooms!notifications_room_id_fkey(id, name, created_at, created_by, is_private)
            `,
              { count: "exact" }
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

          const { data, error } = await query;

          if (error) {
            if (error.code === "PGRST102" || error.message.includes("Could not find a relationship")) {
              console.warn("Falling back to fetch notifications without joins.");

              // Fallback query without joins
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
                  room_id,
                  join_status
                `)
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .range((page - 1) * limit, page * limit - 1);

              if (fallbackError) {
                throw new Error(fallbackError.message || "Failed to fetch notifications (fallback)");
              }

              if (!fallbackData) {
                set({ notifications: [] });
                return;
              }

              const enhancedData = await Promise.all(
                fallbackData.map(async (notif: RawNotification) => {
                  const users = notif.sender_id ? await fetchUserData(notif.sender_id) : null;
                  const recipient = notif.user_id ? await fetchUserData(notif.user_id) : null;
                  let rooms: Room | null = null;
                  if (notif.room_id) {
                    const { data: roomData, error: roomError } = await supabase
                      .from("rooms")
                      .select("id, name, created_at, created_by, is_private")
                      .eq("id", notif.room_id)
                      .single();

                    if (roomError) {
                      console.warn(`Failed to fetch room ${notif.room_id}:`, roomError.message);
                    } else {
                      rooms = roomData;
                    }
                  }

                  return { ...notif, users, recipient, rooms };
                })
              );

              const formattedNotifications = enhancedData.map(transformNotification);
              set({ notifications: formattedNotifications });
              return;
            }
            throw new Error(error.message || "Failed to fetch notifications");
          }

          if (!data) {
            set({ notifications: [] });
            return;
          }

          const formattedNotifications = data.map(transformNotification);
          set({ notifications: formattedNotifications });
          return;
        } catch (error) {
          if (attempt === retries) {
            toast.error(error instanceof Error ? error.message : "Failed to fetch notifications");
            console.error(`Error fetching notifications (attempt ${attempt}/${retries}):`, error);
          } else {
            console.warn(`Retrying fetchNotifications (attempt ${attempt}/${retries})...`);
            await delay(1000 * attempt);
          }
        }
      }
    },

    subscribeToNotifications: (userId: string) => {
      if (channel) {
        supabase.removeChannel(channel);
      }

      channel = supabase
        .channel(`notifications:${userId}`)
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
              const data = payload.new as RawNotification;

              const users = data.sender_id ? await fetchUserData(data.sender_id) : null;
              const recipient = data.user_id ? await fetchUserData(data.user_id) : null;
              let rooms: Room | null = null;
              if (data.room_id) {
                const { data: roomData, error: roomError } = await supabase
                  .from("rooms")
                  .select("id, name, created_at, created_by, is_private")
                  .eq("id", data.room_id)
                  .single();

                if (roomError) {
                  console.warn(`Failed to fetch room ${data.room_id}:`, roomError.message);
                } else {
                  rooms = roomData;
                }
              }

              const formattedNotification = transformNotification({
                ...data,
                users,
                recipient,
                rooms,
              });

              set((state) => {
                const newNotifications = [formattedNotification, ...state.notifications].slice(0, 20);
                if (!formattedNotification.is_read) {
                  toast.info(formattedNotification.content);
                }
                return { notifications: newNotifications };
              });
            } catch (error) {
              console.error("Error processing INSERT notification:", error);
              toast.error("Failed to process new notification");
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
            try {
              const updatedData = payload.new as RawNotification;

              const users = updatedData.sender_id ? await fetchUserData(updatedData.sender_id) : null;
              const recipient = updatedData.user_id ? await fetchUserData(updatedData.user_id) : null;
              let rooms: Room | null = null;
              if (updatedData.room_id) {
                const { data: roomData, error: roomError } = await supabase
                  .from("rooms")
                  .select("id, name, created_at, created_by, is_private")
                  .eq("id", updatedData.room_id)
                  .single();

                if (roomError) {
                  console.warn(`Failed to fetch room ${updatedData.room_id}:`, roomError.message);
                } else {
                  rooms = roomData;
                }
              }

              const formattedNotification = transformNotification({
                ...updatedData,
                users,
                recipient,
                rooms,
              });

              set((state) => ({
                notifications: state.notifications.map((notif) =>
                  notif.id === formattedNotification.id ? formattedNotification : notif
                ),
              }));
            } catch (error) {
              console.error("Error processing UPDATE notification:", error);
              toast.error("Failed to process updated notification");
            }
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
            try {
              const deletedId = payload.old.id;
              set((state) => ({
                notifications: state.notifications.filter((notif) => notif.id !== deletedId),
              }));
            } catch (error) {
              console.error("Error processing DELETE notification:", error);
              toast.error("Failed to process deleted notification");
            }
          }
        )
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            console.log(`Subscribed to notifications:${userId}`);
          } else if (status === "CLOSED") {
            console.log(`Channel notifications:${userId} closed`);
            channel = null;
          } else if (status === "CHANNEL_ERROR") {
            console.error(`Channel notifications:${userId} error:`, err);
            toast.error("Error in notification subscription");
          }
        });
    },

    unsubscribeFromNotifications: () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
        console.log("Unsubscribed from notifications channel");
      }
    },
  };
});