// "use client";

// import { create } from "zustand";
// import { getSupabaseBrowserClient } from "@/lib/supabase/client";
// import { RealtimeChannel } from "@supabase/supabase-js";
// import { useEffect } from "react";
// import type { Database } from "../types/supabase";

// /* --------------------------------------------------------------------------
//    TYPES
// -------------------------------------------------------------------------- */

// export type ProfileType = {
//   id: string;
//   username: string | null;
//   display_name: string | null;
//   avatar_url: string | null;
//   created_at: string | null;
// };

// export type RoomType = {
//   id: string;
//   name: string;
//   created_at: string;
//   created_by: string | null;
//   is_private: boolean;
// };

// export type NotificationDBRow =
//   Database["public"]["Tables"]["notifications"]["Row"];

// type RawNotification = NotificationDBRow & {
//   sender?: ProfileType | null;
//   recipient?: ProfileType | null;
//   room?: RoomType | null;
// };

// export interface Notification {
//   id: string;
//   message: string;
//   created_at: string | null;
//   status: string | null;
//   type: string;

//   sender_id: string | null;
//   user_id: string;
//   room_id: string | null;

//   join_status: string | null;
//   direct_chat_id: string | null;

//   users: ProfileType | null;
//   recipient: ProfileType | null;
//   rooms: RoomType | null;
// }

// export type ConnectionHealth = "healthy" | "degraded" | "offline";

// interface NotificationStore {
//   notifications: Notification[];
//   unread: number;
//   isLoading: boolean;
//   hasError: boolean;

//   lastFetch: number | null;
//   lastSuccess: number | null;

//   subscriptionActive: boolean;
//   connectionHealth: ConnectionHealth;

//   /* actions */
//   set: (list: Notification[]) => void;
//   add: (n: Notification) => void;
//   remove: (id: string) => void;

//   fetch: (userId: string) => Promise<void>;

//   subscribe: (userId: string) => void;
//   unsubscribe: () => void;

//   markRead: (id: string) => Promise<void>;
//   markAllRead: (userId: string) => Promise<void>;

//   retry: (userId: string) => void;
// }

// /* --------------------------------------------------------------------------
//    CONSTANTS
// -------------------------------------------------------------------------- */

// const CACHE_TTL = 30_000;

// let channel: RealtimeChannel | null = null;

// /* --------------------------------------------------------------------------
//    HELPERS
// -------------------------------------------------------------------------- */

// const transform = (n: RawNotification): Notification => ({
//   id: n.id,
//   message: n.message,
//   created_at: n.created_at,
//   status: n.status,
//   type: n.type,

//   sender_id: n.sender_id,
//   user_id: n.user_id,
//   room_id: n.room_id,

//   join_status: n.join_status,
//   direct_chat_id: n.direct_chat_id,

//   users: n.sender ?? null,
//   recipient: n.recipient ?? null,
//   rooms: n.room ?? null,
// });

// /* Fetch list */
// const fetchAll = async (userId: string) => {
//   const supabase = getSupabaseBrowserClient();

//   const { data, error } = await supabase
//     .from("notifications")
//     .select(
//       `
//       *,
//       sender:profiles!notifications_sender_id_fkey(id,username,display_name,avatar_url,created_at),
//       recipient:profiles!notifications_user_id_fkey(id,username,display_name,avatar_url,created_at),
//       room:rooms!notifications_room_id_fkey(id,name,created_by,is_private,created_at)
//       `
//     )
//     .eq("user_id", userId)
//     .order("created_at", { ascending: false })
//     .limit(50);

//   return { data: data as RawNotification[] | null, error };
// };

// /* Fetch single */
// const fetchSingle = async (id: string) => {
//   const supabase = getSupabaseBrowserClient();

//   const { data, error } = await supabase
//     .from("notifications")
//     .select(
//       `
//       *,
//       sender:profiles!notifications_sender_id_fkey(id,username,display_name,avatar_url,created_at),
//       recipient:profiles!notifications_user_id_fkey(id,username,display_name,avatar_url,created_at),
//       room:rooms!notifications_room_id_fkey(id,name,created_by,is_private,created_at)
//       `
//     )
//     .eq("id", id)
//     .maybeSingle();

//   return { data: data as RawNotification | null, error };
// };

// /* --------------------------------------------------------------------------
//    STORE IMPLEMENTATION
// -------------------------------------------------------------------------- */

// export const useNotifications = create<NotificationStore>((set, get) => {
//   const supabase = getSupabaseBrowserClient();

//   return {
//     notifications: [],
//     unread: 0,
//     isLoading: false,
//     hasError: false,

//     lastFetch: null,
//     lastSuccess: null,

//     subscriptionActive: false,
//     connectionHealth: "healthy",

//     /* ---------------------------------------------
//        Set notifications
//     --------------------------------------------- */
//     set: (list) =>
//       set({
//         notifications: list,
//         unread: list.filter((n) => n.status === "unread").length,
//       }),

//     /* ---------------------------------------------
//        Add new notification
//     --------------------------------------------- */
//     add: (n) =>
//       set((st) => {
//         if (st.notifications.find((x) => x.id === n.id)) return st;
//         const updated = [n, ...st.notifications];
//         return {
//           notifications: updated,
//           unread: updated.filter((x) => x.status === "unread").length,
//         };
//       }),

//     /* ---------------------------------------------
//        Remove notification
//     --------------------------------------------- */
//     remove: (id) =>
//       set((st) => {
//         const updated = st.notifications.filter((n) => n.id !== id);
//         return {
//           notifications: updated,
//           unread: updated.filter((n) => n.status === "unread").length,
//         };
//       }),

//     /* ---------------------------------------------
//        Fetch list
//     --------------------------------------------- */
//     fetch: async (userId: string) => {
//       if (!userId) return;
//       set({ isLoading: true });

//       const now = Date.now();
//       const lastFetch = get().lastFetch;

//       if (lastFetch && now - lastFetch < CACHE_TTL) {
//         set({ isLoading: false });
//         return;
//       }

//       const { data, error } = await fetchAll(userId);

//       if (error) {
//         set({ hasError: true, connectionHealth: "degraded", isLoading: false });
//         return;
//       }

//       const list = (data ?? []).map(transform);

//       set({
//         notifications: list,
//         unread: list.filter((n) => n.status === "unread").length,
//         isLoading: false,
//         hasError: false,
//         lastFetch: now,
//         lastSuccess: now,
//         connectionHealth: "healthy",
//       });
//     },

//     /* ---------------------------------------------
//        Subscribe realtime
//     --------------------------------------------- */
//     subscribe: (userId: string) => {
//       if (!userId) return;

//       if (channel) {
//         supabase.removeChannel(channel);
//         channel = null;
//       }

//       channel = supabase
//         .channel(`notifications:${userId}`)
//         .on("postgres_changes", {
//           event: "INSERT",
//           schema: "public",
//           table: "notifications",
//           filter: `user_id=eq.${userId}`,
//         }, async (payload) => {
//           const { data } = await fetchSingle(payload.new.id);
//           if (data) get().add(transform(data));
//         })
//         .on("postgres_changes", {
//           event: "UPDATE",
//           schema: "public",
//           table: "notifications",
//           filter: `user_id=eq.${userId}`,
//         }, (payload) => {
//           set((st) => {
//             const idx = st.notifications.findIndex((n) => n.id === payload.new.id);
//             if (idx === -1) return st;

//             const updated = [...st.notifications];
//             updated[idx] = transform(payload.new as RawNotification);

//             return {
//               notifications: updated,
//               unread: updated.filter((n) => n.status === "unread").length,
//             };
//           });
//         })
//         .on("postgres_changes", {
//           event: "DELETE",
//           schema: "public",
//           table: "notifications",
//           filter: `user_id=eq.${userId}`,
//         }, (payload) => {
//           get().remove(payload.old.id);
//         })
//         .subscribe((status) => {
//           set({ subscriptionActive: status === "SUBSCRIBED" });

//           if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
//             set({ connectionHealth: "offline" });
//           }
//         });
//     },

//     unsubscribe: () => {
//       if (channel) getSupabaseBrowserClient().removeChannel(channel);
//       channel = null;
//       set({ subscriptionActive: false });
//     },

//     /* ---------------------------------------------
//        Mark single read
//     --------------------------------------------- */
//     markRead: async (id) => {
//       const supabase = getSupabaseBrowserClient();
//       await supabase.from("notifications").update({ status: "read" }).eq("id", id);

//       set((st) => {
//         const updated = st.notifications.map((n) =>
//           n.id === id ? { ...n, status: "read" } : n
//         );
//         return {
//           notifications: updated,
//           unread: updated.filter((n) => n.status === "unread").length,
//         };
//       });
//     },

//     /* ---------------------------------------------
//        Mark all read
//     --------------------------------------------- */
//     markAllRead: async (userId) => {
//       const supabase = getSupabaseBrowserClient();
//       await supabase.from("notifications").update({ status: "read" }).eq("user_id", userId);

//       set((st) => ({
//         notifications: st.notifications.map((n) => ({ ...n, status: "read" })),
//         unread: 0,
//       }));
//     },

//     /* ---------------------------------------------
//        Retry realtime
//     --------------------------------------------- */
//     retry: (userId) => {
//       get().unsubscribe();
//       setTimeout(() => get().subscribe(userId), 800);
//     },
//   };
// });

// /* --------------------------------------------------------------------------
//    BACKWARD COMPATIBILITY
// -------------------------------------------------------------------------- */

// export const useNotification = useNotifications;

// export type Inotification = Notification;

// export const useNotificationSubscription = (userId: string | null) => {
//   const { subscribe, unsubscribe, fetch } = useNotifications();

//   useEffect(() => {
//     if (!userId) return;

//     fetch(userId);
//     subscribe(userId);

//     return () => unsubscribe();
//   }, [userId, fetch, subscribe, unsubscribe]);
// };

