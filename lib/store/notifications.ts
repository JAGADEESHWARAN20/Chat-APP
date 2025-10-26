// lib/store/notifications.ts - Full updated notification store with fixes for TypeScript errors (no .catch() on PostgrestBuilder, inlined transformNotification, enhanced error handling)
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

  // Inlined transformNotification function to avoid import issues
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
        // First, try basic fetch without joins to isolate if joins are the issue
        const { data: rawData, error: basicError } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (basicError) throw basicError;

        console.log("Basic fetch - Raw notifications count:", rawData?.length || 0);
        console.log("Basic fetch - Sample data:", rawData?.slice(0, 2) || []); // Debug: log first 2

        if (!rawData || rawData.length === 0) {
          console.log("No notifications found for user:", userId);
          set({ notifications: [] });
          return;
        }

        // Now enrich with relations if basic fetch succeeds
        const enrichedData: NotificationWithRelations[] = [];
        for (const n of rawData) {
          try {
            // Fetch sender profile
            let senderData: ProfileType | null = null;
            try {
              const { data } = await supabase
                .from("profiles")
                .select("id, username, display_name, avatar_url, created_at")
                .eq("id", n.sender_id || "")
                .single();
              senderData = data || null;
            } catch (senderErr) {
              console.warn("Sender profile fetch failed:", senderErr);
              senderData = null;
            }

            // Fetch recipient (should be current user, but for completeness)
            let recipientData: ProfileType | null = null;
            try {
              const { data } = await supabase
                .from("profiles")
                .select("id, username, display_name, avatar_url, created_at")
                .eq("id", n.user_id)
                .single();
              recipientData = data || null;
            } catch (recipientErr) {
              console.warn("Recipient profile fetch failed:", recipientErr);
              recipientData = null;
            }

            // Fetch room
            let roomData: RoomType | null = null;
            try {
              const { data } = await supabase
                .from("rooms")
                .select("id, name, created_at, created_by, is_private")
                .eq("id", n.room_id || "")
                .single();
              roomData = data || null;
            } catch (roomErr) {
              console.warn("Room fetch failed:", roomErr);
              roomData = null;
            }

            enrichedData.push({
              ...n,
              sender: senderData,
              recipient: recipientData,
              room: roomData,
            });
          } catch (enrichErr) {
            console.error("Enrichment failed for notification", n.id, ":", enrichErr);
            // Fallback to raw data without relations
            enrichedData.push({ ...n, sender: null, recipient: null, room: null } as NotificationWithRelations);
          }
        }

        const transformed = enrichedData.map(transformNotification);
        console.log("Enriched & transformed notifications count:", transformed.length);
        console.log("Transformed sample:", transformed.slice(0, 2)); // Debug

        set({ notifications: transformed });
      } catch (err: any) {
        console.error("Error fetching notifications:", err);
        toast.error("Failed to fetch notifications.");
        if (retries > 0) {
          console.log(`Retrying fetch... (${retries} left)`);
          setTimeout(
            () => get().fetchNotifications(userId, page, limit, retries - 1),
            1000
          );
        }
      }
    },

    subscribeToNotifications: (userId: string) => {
      notificationChannel?.unsubscribe(); // Clean up previous

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
          async (payload) => {
            const newNotifRaw = payload.new as NotificationRow;
            console.log("Realtime raw notification:", newNotifRaw); // Debug

            // Enrich the realtime notification similarly
            let enrichedNewNotif: NotificationWithRelations;
            try {
              // Fetch sender profile
              let senderData: ProfileType | null = null;
              try {
                const { data } = await supabase
                  .from("profiles")
                  .select("id, username, display_name, avatar_url, created_at")
                  .eq("id", newNotifRaw.sender_id || "")
                  .single();
                senderData = data || null;
              } catch (senderErr) {
                console.warn("Realtime sender profile fetch failed:", senderErr);
                senderData = null;
              }

              // Fetch recipient
              let recipientData: ProfileType | null = null;
              try {
                const { data } = await supabase
                  .from("profiles")
                  .select("id, username, display_name, avatar_url, created_at")
                  .eq("id", newNotifRaw.user_id)
                  .single();
                recipientData = data || null;
              } catch (recipientErr) {
                console.warn("Realtime recipient profile fetch failed:", recipientErr);
                recipientData = null;
              }

              // Fetch room
              let roomData: RoomType | null = null;
              try {
                const { data } = await supabase
                  .from("rooms")
                  .select("id, name, created_at, created_by, is_private")
                  .eq("id", newNotifRaw.room_id || "")
                  .single();
                roomData = data || null;
              } catch (roomErr) {
                console.warn("Realtime room fetch failed:", roomErr);
                roomData = null;
              }

              enrichedNewNotif = {
                ...newNotifRaw,
                sender: senderData,
                recipient: recipientData,
                room: roomData,
              };
            } catch (enrichErr) {
              console.error("Realtime enrichment failed:", enrichErr);
              // Fallback to raw
              enrichedNewNotif = { ...newNotifRaw, sender: null, recipient: null, room: null } as NotificationWithRelations;
            }

            const transformed = transformNotification(enrichedNewNotif);
            console.log("Realtime transformed notification:", transformed); // Debug

            set((state) => {
              // Avoid duplicates
              if (!state.notifications.some((n) => n.id === transformed.id)) {
                return {
                  notifications: [transformed, ...state.notifications],
                };
              }
              return state;
            });

            toast("🔔 New notification received");
          }
        )
        .subscribe((status) => {
          console.log("Subscription status:", status); // Debug
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