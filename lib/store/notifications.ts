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

    markAsRead: (notificationId) =>
      set((state) => ({
        notifications: state.notifications.map((notif) =>
          notif.id === notificationId ? { ...notif, status: "read" } : notif
        ),
      })),

    fetchNotifications: async (userId, page = 1, limit = 20, retries = 3) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
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
              direct_chat_id,
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
              console.warn("[Notifications Store] Falling back to fetch notifications without joins.");

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
                  join_status,
                  direct_chat_id
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

                    if (!roomError) {
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
            console.error(`[Notifications Store] Error fetching notifications (attempt ${attempt}/${retries}):`, error);
          } else {
            console.warn(`[Notifications Store] Retrying fetchNotifications (attempt ${attempt}/${retries})...`);
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
                const { data: roomData } = await supabase
                  .from("rooms")
                  .select("id, name, created_at, created_by, is_private")
                  .eq("id", data.room_id)
                  .single();

                rooms = roomData;
              }

              const formattedNotification = transformNotification({
                ...data,
                users,
                recipient,
                rooms,
                direct_chat_id: data.direct_chat_id,
              });

              set((state) => {
                const updatedNotifications = state.notifications.map((notif) =>
                  notif.id === formattedNotification.id
                    ? { ...notif, ...formattedNotification } // force re-render
                    : notif
                );
                return { notifications: updatedNotifications };
              });
            } catch (error) {
              console.error("[Notifications Store] Error processing INSERT notification:", error);
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
                const { data: roomData } = await supabase
                  .from("rooms")
                  .select("id, name, created_at, created_by, is_private")
                  .eq("id", updatedData.room_id)
                  .single();

                rooms = roomData;
              }

              const formattedNotification = transformNotification({
                ...updatedData,
                users,
                recipient,
                rooms,
                direct_chat_id: updatedData.direct_chat_id,
              });

              set((state) => ({
                notifications: state.notifications.map((notif) =>
                  notif.id === formattedNotification.id ? formattedNotification : notif
                ),
              }));
            } catch (error) {
              console.error("[Notifications Store] Error processing UPDATE notification:", error);
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
            set((state) => ({
              notifications: state.notifications.filter((notif) => notif.id !== payload.old.id),
            }));
          }
        )
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            console.log(`[Notifications Store] Subscribed to notifications:${userId}`);
          } else if (err) {
            console.error(`[Notifications Store] Channel error:`, err);
          }
        });
    },

    unsubscribeFromNotifications: () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    },
  };
});