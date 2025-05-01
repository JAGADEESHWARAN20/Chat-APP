import { create } from "zustand";
import { supabaseBrowser } from "../supabase/browser";

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
          avatar_url: string;
     } | null;
     rooms: {
          id: string;
          name: string;
     } | null;
}

interface NotificationState {
     notifications: Inotification[];
     setNotifications: (notifications: Inotification[]) => void;
     addNotification: (notification: Inotification) => void;
     markAsRead: (notificationId: string) => void;
     subscribeToNotifications: (userId: string) => void;
     unsubscribeFromNotifications: () => void;
}

export const useNotification = create<NotificationState>((set) => ({
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
     subscribeToNotifications: (userId) => {
          const supabase = supabaseBrowser();
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
                    async (payload) => {
                         const newNotification = payload.new as any;

                         // Fetch additional data for users and rooms
                         const { data: userData, error: userError } = await supabase
                              .from("users")
                              .select("id, username, display_name, avatar_url")
                              .eq("id", newNotification.sender_id)
                              .single();
                         if (userError) {
                              console.error("Error fetching user for notification:", userError);
                         }

                         const { data: roomData, error: roomError } = await supabase
                              .from("rooms")
                              .select("id, name")
                              .eq("id", newNotification.room_id)
                              .single();
                         if (roomError) {
                              console.error("Error fetching room for notification:", roomError);
                         }

                         const formattedNotification: Inotification = {
                              id: newNotification.id,
                              content: newNotification.message,
                              created_at: newNotification.created_at,
                              is_read: newNotification.status === "read",
                              type: newNotification.type,
                              sender_id: newNotification.sender_id,
                              room_id: newNotification.room_id,
                              users: userData || null,
                              rooms: roomData || null,
                         };

                         set((state) => ({
                              notifications: [formattedNotification, ...state.notifications],
                         }));
                    }
               )
               .subscribe((status, err) => {
                    if (status === "SUBSCRIBED") {
                         console.log("Subscribed to notifications channel");
                    } else if (status === "CLOSED") {
                         console.error("Notification channel closed");
                    } else if (status === "CHANNEL_ERROR") {
                         console.error("Notification channel error:", err);
                    }
               });
     },
     unsubscribeFromNotifications: () => {
          const supabase = supabaseBrowser();
          supabase.removeAllChannels();
     },
}));