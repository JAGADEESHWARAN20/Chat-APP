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

interface RawMainNotification {
  id: string;
  message: string;
  created_at: string | null;
  status: string | null;
  type: string;
  sender_id: string | null;
  user_id: string;
  room_id: string | null;
  users: { id: string; username: string; display_name: string; avatar_url: string | null }[] | null;
  recipient: { id: string; username: string; display_name: string; avatar_url: string | null }[] | null;
  rooms: { id: string; name: string }[] | null;
}

interface RawFallbackNotification {
  id: string;
  message: string;
  created_at: string | null;
  status: string | null;
  type: string;
  sender_id: string | null;
  user_id: string;
  room_id: string | null;
}

interface FallbackNotification {
  id: string;
  message: string;
  created_at: string | null;
  status: string | null;
  type: string;
  sender_id: string | null;
  user_id: string;
  room_id: string | null;
  users: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
  recipient: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
  rooms: { id: string; name: string } | null;
}

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
  const usersCache = new Map<string, any>();

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
          let notificationsData: (RawMainNotification | FallbackNotification)[] = [];

          // Attempt main query with joins
          const mainQuery = supabase
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

          const { data: mainData, error: mainError } = await mainQuery;

          if (mainError) {
            if (mainError.message.includes("Could not find a relationship")) {
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

              if (!fallbackData) {
                set({ notifications: [] });
                return;
              }

              const enhancedData: FallbackNotification[] = await Promise.all(
                fallbackData.map(async (notif: RawFallbackNotification) => {
                  const users = notif.sender_id ? await fetchUserData(notif.sender_id) : null;
                  const recipient = notif.user_id ? await fetchUserData(notif.user_id) : null;
                  let rooms: { id: string; name: string } | null = null;
                  if (notif.room_id) {
                    const { data: roomData, error: roomError } = await supabase
                      .from("rooms")
                      .select("id, name")
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

              notificationsData = enhancedData;
            } else {
              throw new Error(mainError.message || "Failed to fetch notifications");
            }
          } else {
            notificationsData = mainData as RawMainNotification[];
          }

          if (!notificationsData) {
            set({ notifications: [] });
            return;
          }

          const formattedNotifications: Inotification[] = notificationsData.map(
            (notif: RawMainNotification | FallbackNotification) => {
              const users = "users" in notif && notif.users
                ? Array.isArray(notif.users)
                  ? notif.users.length > 0
                    ? notif.users[0]
                    : null
                  : notif.users
                : null;

              const recipient = "recipient" in notif && notif.recipient
                ? Array.isArray(notif.recipient)
                  ? notif.recipient.length > 0
                    ? notif.recipient[0]
                    : null
                  : notif.recipient
                : null;

              const rooms = "rooms" in notif && notif.rooms
                ? Array.isArray(notif.rooms)
                  ? notif.rooms.length > 0
                    ? notif.rooms[0]
                    : null
                  : notif.rooms
                : null;

              return {
                id: notif.id,
                content: notif.message,
                created_at: notif.created_at ?? "",
                is_read: notif.status === "read",
                type: notif.type,
                sender_id: notif.sender_id ?? "",
                user_id: notif.user_id,
                room_id: notif.room_id,
                users,
                recipient,
                rooms,
              };
            }
          );

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
              id: Dishant notification_id: string;
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

            interface RawMainNotification {
              id: string;
              message: string;
              created_at: string | null;
              status: string | null;
              type: string;
              sender_id: string | null;
              user_id: string;
              room_id: string | null;
              users: { id: string; username: string; display_name: string; avatar_url: string | null }[] | null;
              recipient: { id: string; username: string; display_name: string; avatar_url: string | null }[] | null;
              rooms: { id: string; name: string }[] | null;
            }

            interface RawFallbackNotification {
              id: string;
              message: string;
              created_at: string | null;
              status: string | null;
              type: string;
              sender_id: string | null;
              user_id: string;
              room_id: string | null;
            }

            interface FallbackNotification {
              id: string;
              message: string;
              created_at: string | null;
              status: string | null;
              type: string;
              sender_id: string | null;
              user_id: string;
              room_id: string | null;
              users: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
              recipient: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
              rooms: { id: string; name: string } | null;
            }

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
              const usersCache = new Map<string, any>();

              const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
                      let notificationsData: (RawMainNotification | FallbackNotification)[] = [];

                      // Attempt main query with joins
                      const mainQuery = supabase
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

                      const { data: mainData, error: mainError } = await mainQuery;

                      if (mainError) {
                        if (mainError.message.includes("Could not find a relationship")) {
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

                          if (!fallbackData) {
                            set({ notifications: [] });
                            return;
                          }

                          const enhancedData: FallbackNotification[] = await Promise.all(
                            fallbackData.map(async (notif: RawFallbackNotification) => {
                              const users = notif.sender_id ? await fetchUserData(notif.sender_id) : null;
                              const recipient = notif.user_id ? await fetchUserData(notif.user_id) : null;
                              let rooms: { id: string; name: string } | null = null;
                              if (notif.room_id) {
                                const { data: roomData, error: roomError } = await supabase
                                  .from("rooms")
                                  .select("id, name")
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

                          notificationsData = enhancedData;
                        } else {
                          throw new Error(mainError.message || "Failed to fetch notifications");
                        }
                      } else {
                        notificationsData = mainData as RawMainNotification[];
                      }

                      if (!notificationsData) {
                        set({ notifications: [] });
                        return;
                      }

                      const formattedNotifications: Inotification[] = notificationsData.map(
                        (notif: RawMainNotification | FallbackNotification) => {
                          const users = "users" in notif && notif.users
                            ? Array.isArray(notif.users)
                              ? notif.users.length > 0
                                ? notif.users[0]
                                : null
                              : notif.users
                            : null;

                          const recipient = "recipient" in notif && notif.recipient
                            ? Array.isArray(notif.recipient)
                              ? notif.recipient.length > 0
                                ? notif.recipient[0]
                                : null
                              : notif.recipient
                            : null;

                          const rooms = "rooms" in notif && notif.rooms
                            ? Array.isArray(notif.rooms)
                              ? notif.rooms.length > 0
                                ? notif.rooms[0]
                                : null
                              : notif.rooms
                            : null;

                          return {
                            id: notif.id,
                            content: notif.message,
                            created_at: notif.created_at ?? "",
                            is_read: notif.status === "read",
                            type: notif.type,
                            sender_id: notif.sender_id ?? "",
                            user_id: notif.user_id,
                            room_id: notif.room_id,
                            users,
                            recipient,
                            rooms,
                          };
                        }
                      );

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
                          sender_id: data.sender_id ?? "",
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