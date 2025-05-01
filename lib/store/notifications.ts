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
               .channel("notifications")
               .on(
                    "postgres_changes",
                    {
                         event: "INSERT",
                         schema: "public",
                         table: "notifications",
                         filter: `user_id=eq.${userId}`,
                    },
                    (payload) => {
                         set((state) => ({
                              notifications: [payload.new as Inotification, ...state.notifications],
                         }));
                    }
               )
               .subscribe();
     },
     unsubscribeFromNotifications: () => {
          const supabase = supabaseBrowser();
          supabase.removeAllChannels();
     },
}));