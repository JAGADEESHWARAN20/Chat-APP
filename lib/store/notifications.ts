import { create } from "zustand";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { Database } from "@/lib/types/supabase";

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
  markAsRead: (notificationId: string) => Promise<void>;
  fetchNotifications: (userId: string, page?: number, limit?: number, retries?: number) => Promise<void>;
  subscribeToNotifications: (userId: string) => void;
  unsubscribeFromNotifications: () => void;
}

export const useNotification = create<NotificationState>((set, get) => {
  const supabase = supabaseBrowser();
  let notificationChannel: ReturnType<typeof supabase.channel> | null = null;

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  return {
    notifications: [],

    setNotifications: (notifications) => 
      set({ notifications }),

    addNotification: (notification) => {
      console.log("[Notifications] Adding notification:", notification);
      set((state) => ({
        notifications: [notification, ...state.notifications].slice(0, 20),
      }));
    },

    markAsRead: async (notificationId: string) => {
      try {
        console.log("[Notifications] Marking as read:", notificationId);
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
        console.error("[Notifications] Error marking as read:", error);
        toast.error("Failed to mark notification as read");
      }
    },

    fetchNotifications: async (userId: string, page = 1, limit = 20, retries = 3) => {
      console.log("[Notifications] Fetching notifications for user:", userId);
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

          console.log("[Notifications] Fetched notifications:", notifications?.length || 0);
          set({ notifications: notifications || [] });
          return;
        } catch (error) {
          console.error(`[Notifications] Fetch attempt ${attempt} failed:`, error);
          if (attempt === retries) {
            toast.error("Failed to load notifications");
            return;
          }
          await delay(1000 * attempt);
        }
      }
    },

    subscribeToNotifications: (userId: string) => {
      console.log("[Notifications] Setting up subscription for user:", userId);
      
      if (notificationChannel) {
        console.log("[Notifications] Cleaning up existing subscription");
        notificationChannel.unsubscribe();
      }

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
            console.log("[Notifications] Received real-time event:", payload.eventType, payload);
            
            if (payload.eventType === "INSERT") {
              const newNotification = payload.new as RawNotification;
              
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
                console.error("[Notifications] Error fetching full notification:", error);
                return;
              }

              console.log("[Notifications] Fetched full notification:", fullNotification);

              if (fullNotification) {
                get().addNotification(fullNotification as Inotification);
                
                // Show toast notification based on type
                const message = fullNotification.type === "room_invite" 
                  ? `${fullNotification.users?.display_name || "Someone"} invited you to join ${fullNotification.rooms?.name || "a room"}`
                  : fullNotification.type === "message"
                  ? `New message in ${fullNotification.rooms?.name || "a room"}`
                  : fullNotification.message;
                
                toast(message, {
                  description: fullNotification.users?.display_name || "Someone",
                  action: {
                    label: "View",
                    onClick: () => {
                      // Handle notification click if needed
                    }
                  }
                });
              }
            }
          }
        )
        .subscribe((status) => {
          console.log("[Notifications] Subscription status:", status);
        });
    },

    unsubscribeFromNotifications: () => {
      if (notificationChannel) {
        console.log("[Notifications] Unsubscribing from notifications");
        notificationChannel.unsubscribe();
        notificationChannel = null;
      }
    },
  };
});