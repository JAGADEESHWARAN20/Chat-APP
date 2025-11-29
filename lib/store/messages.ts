"use client";

import { create } from "zustand";
import { LIMIT_MESSAGE } from "../constant";
import { Database } from "@/lib/types/supabase";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/sonner";
import {
  RealtimePostgresUpdatePayload,
  RealtimePostgresDeletePayload,
} from "@supabase/supabase-js";

// ---------- Helpers ----------

export const transformApiMessage = (row: any): Imessage => ({
  ...row,
  is_edited: row.is_edited ?? false,
  status: row.status ?? null,
  direct_chat_id: row.direct_chat_id ?? null,
  dm_thread_id: row.dm_thread_id ?? null,
  room_id: row.room_id ?? null,
  profiles: row.profiles ?? {
    id: row.sender_id,
    username: null,
    display_name: null,
    avatar_url: null,
    bio: null,
    created_at: null,
    updated_at: null,
  },
});

export type MessageWithProfile =
  Database["public"]["Tables"]["messages"]["Row"] & {
    profiles: Database["public"]["Tables"]["profiles"]["Row"];
  };

export type Imessage = {
  id: string;
  text: string;
  sender_id: string;
  created_at: string;
  is_edited: boolean;
  room_id: string | null;
  direct_chat_id: string | null;
  dm_thread_id: string | null;
  status: string | null;
  profiles: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    created_at: string | null;
    updated_at: string | null;
  } | null;
};

type ActionMessage = Imessage | null;
type ActionType = "edit" | "delete" | null;

// Per-room bucket – this is the core of caching
interface RoomBucket {
  messages: Imessage[];
  hasMore: boolean;
  isLoading: boolean;
  initialized: boolean;
  oldestCreatedAt: string | null; // for pagination later (before=cursor)
}

type SupabaseChannel = ReturnType<
  ReturnType<typeof getSupabaseBrowserClient>["channel"]
>;

interface MessageState {
  // 👇 which room is currently active in the UI
  activeRoomId: string | null;

  // 👇 messages for the *active* room only (for components)
  messages: Imessage[];
  hasMore: boolean;

  // 👇 full cache: all rooms you’ve touched this session
  roomBuckets: Record<string, RoomBucket>;

  actionMessage: ActionMessage;
  actionType: ActionType;
  optimisticIds: string[];
  currentSubscription: SupabaseChannel | null;

  // Basic ops
  setActiveRoom: (roomId: string | null) => void;
  setMessages: (messages: Imessage[]) => void;
  clearMessages: () => void;
  addMessage: (message: Imessage) => void;
  setOptimisticIds: (id: string) => void;

  setActionMessage: (message: Imessage, type: ActionType) => void;
  resetActionMessage: () => void;

  optimisticDeleteMessage: (messageId: string) => void;
  optimisticUpdateMessage: (
    messageId: string,
    updates: Partial<Imessage>
  ) => void;

  // 🚀 NEW: room-aware loading
  loadInitialMessages: (roomId: string, opts?: { force?: boolean }) => Promise<void>;
  loadMoreMessages: (roomId: string) => Promise<void>;

  // realtime
  subscribeToRoom: (roomId?: string, directChatId?: string) => void;
  unsubscribeFromRoom: () => void;

  // server-side search
  searchMessages: (roomId: string, query: string) => Promise<Imessage[]>;
}

const mergeBucketMessages = (
  existing: Imessage[],
  incoming: Imessage[]
): Imessage[] => {
  const byId = new Map<string, Imessage>();
  for (const m of existing) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);

  // sort ascending (oldest → newest)
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

export const useMessage = create<MessageState>()((set, get) => ({
  activeRoomId: null,
  messages: [],
  hasMore: true,
  roomBuckets: {},

  optimisticIds: [],
  actionMessage: null,
  actionType: null,
  currentSubscription: null,

  // ---------------------------
  // Core room selection
  // ---------------------------
  setActiveRoom: (roomId) =>
    set((state) => {
      if (!roomId) {
        return {
          activeRoomId: null,
          messages: [],
          hasMore: true,
        };
      }

      const bucket = state.roomBuckets[roomId];
      if (!bucket) {
        // no cache yet – UI will show skeleton until loadInitialMessages finishes
        return {
          activeRoomId: roomId,
          messages: [],
          hasMore: true,
        };
      }

      return {
        activeRoomId: roomId,
        messages: bucket.messages,
        hasMore: bucket.hasMore,
      };
    }),

  // ⚠️ backwards compatible: applies only to activeRoomId bucket + messages
  setMessages: (incoming) =>
    set((state) => {
      const roomId = state.activeRoomId;
      if (!roomId) {
        return {
          messages: incoming.map(transformApiMessage),
          hasMore: incoming.length >= LIMIT_MESSAGE,
        };
      }

      const transformed = incoming.map(transformApiMessage);
      const sorted = transformed.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const bucket: RoomBucket = {
        messages: sorted,
        hasMore: sorted.length >= LIMIT_MESSAGE,
        isLoading: false,
        initialized: true,
        oldestCreatedAt: sorted[0]?.created_at ?? null,
      };

      return {
        activeRoomId: roomId,
        messages: sorted,
        hasMore: bucket.hasMore,
        roomBuckets: {
          ...state.roomBuckets,
          [roomId]: bucket,
        },
      };
    }),

  clearMessages: () =>
    set(() => ({
      activeRoomId: null,
      messages: [],
      hasMore: true,
      roomBuckets: {},
      optimisticIds: [],
      actionMessage: null,
      actionType: null,
      currentSubscription: null,
    })),

  // ---------------------------
  // Add / Update / Delete
  // ---------------------------
  addMessage: (message) =>
    set((state) => {
      const roomId =
        message.room_id ?? message.direct_chat_id ?? state.activeRoomId;
      if (!roomId) return state;

      const existingBucket = state.roomBuckets[roomId] ?? {
        messages: [],
        hasMore: true,
        isLoading: false,
        initialized: false,
        oldestCreatedAt: null,
      };

      // avoid duplicates
      if (existingBucket.messages.some((m) => m.id === message.id)) {
        return state;
      }

      const mergedMessages = mergeBucketMessages(existingBucket.messages, [
        transformApiMessage(message),
      ]);

      const nextBucket: RoomBucket = {
        ...existingBucket,
        messages: mergedMessages,
        initialized: true,
        oldestCreatedAt: mergedMessages[0]?.created_at ?? null,
      };

      return {
        ...state,
        roomBuckets: {
          ...state.roomBuckets,
          [roomId]: nextBucket,
        },
        messages:
          state.activeRoomId === roomId ? mergedMessages : state.messages,
        hasMore:
          state.activeRoomId === roomId ? nextBucket.hasMore : state.hasMore,
      };
    }),

  setOptimisticIds: (id) =>
    set((state) => ({
      optimisticIds: [...state.optimisticIds, id],
    })),

  setActionMessage: (message, type) =>
    set({ actionMessage: message, actionType: type }),

  resetActionMessage: () =>
    set({ actionMessage: null, actionType: null }),

  optimisticDeleteMessage: (messageId) =>
    set((state) => {
      // remove from active list
      const filtered = state.messages.filter((m) => m.id !== messageId);

      // remove from all buckets
      const nextBuckets: Record<string, RoomBucket> = {};
      for (const [roomId, bucket] of Object.entries(state.roomBuckets)) {
        const msgs = bucket.messages.filter((m) => m.id !== messageId);
        nextBuckets[roomId] = {
          ...bucket,
          messages: msgs,
          oldestCreatedAt: msgs[0]?.created_at ?? null,
        };
      }

      return {
        messages: filtered,
        roomBuckets: nextBuckets,
      };
    }),

  optimisticUpdateMessage: (messageId, updates) =>
    set((state) => {
      // update active room messages
      const nextMessages = state.messages.map((m) =>
        m.id === messageId ? { ...m, ...updates } : m
      );

      // update all buckets
      const nextBuckets: Record<string, RoomBucket> = {};
      for (const [roomId, bucket] of Object.entries(state.roomBuckets)) {
        nextBuckets[roomId] = {
          ...bucket,
          messages: bucket.messages.map((m) =>
            m.id === messageId ? { ...m, ...updates } : m
          ),
        };
      }

      return {
        messages: nextMessages,
        roomBuckets: nextBuckets,
      };
    }),

  // ---------------------------
  // 🚀 NEW: room-aware fetch
  // ---------------------------
  loadInitialMessages: async (roomId, opts) => {
    const { force = false } = opts ?? {};
    const state = get();

    // if we already have cache and not forcing → just use cache
    const existingBucket = state.roomBuckets[roomId];
    if (existingBucket && existingBucket.initialized && !force) {
      set({
        activeRoomId: roomId,
        messages: existingBucket.messages,
        hasMore: existingBucket.hasMore,
      });
      return;
    }

    const supabaseApiUrl = `/api/messages/${roomId}`; // existing route

    try {
      // mark loading in bucket
      set((s) => ({
        roomBuckets: {
          ...s.roomBuckets,
          [roomId]: {
            messages: existingBucket?.messages ?? [],
            hasMore: existingBucket?.hasMore ?? true,
            isLoading: true,
            initialized: existingBucket?.initialized ?? false,
            oldestCreatedAt: existingBucket?.oldestCreatedAt ?? null,
          },
        },
      }));

      const res = await fetch(`${supabaseApiUrl}?limit=${LIMIT_MESSAGE}`, {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error(`Failed to load messages (${res.status})`);
      }

      const data = await res.json();
      const rows = Array.isArray(data.messages) ? data.messages : [];

      const transformed = rows.map(transformApiMessage);
      const sorted = transformed.sort(
        (a: Imessage, b: Imessage) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      

      const bucket: RoomBucket = {
        messages: sorted,
        hasMore: sorted.length >= LIMIT_MESSAGE,
        isLoading: false,
        initialized: true,
        oldestCreatedAt: sorted[0]?.created_at ?? null,
      };

      set((s) => ({
        activeRoomId: roomId,
        messages: sorted,
        hasMore: bucket.hasMore,
        roomBuckets: {
          ...s.roomBuckets,
          [roomId]: bucket,
        },
      }));
    } catch (err) {
      console.error("loadInitialMessages error:", err);
      toast.error("Failed to load messages");
      set((s) => ({
        roomBuckets: {
          ...s.roomBuckets,
          [roomId]: {
            messages: existingBucket?.messages ?? [],
            hasMore: existingBucket?.hasMore ?? true,
            isLoading: false,
            initialized: existingBucket?.initialized ?? false,
            oldestCreatedAt: existingBucket?.oldestCreatedAt ?? null,
          },
        },
      }));
    }
  },

  // Discord-style load older messages when scrolling up
  loadMoreMessages: async (roomId) => {
    const state = get();
    const bucket = state.roomBuckets[roomId];

    if (!bucket || !bucket.hasMore || bucket.isLoading) return;

    const oldest = bucket.oldestCreatedAt;
    if (!oldest) return;

    const url = new URL(`/api/messages/${roomId}`, window.location.origin);
    url.searchParams.set("limit", String(LIMIT_MESSAGE));
    url.searchParams.set("before", oldest); // backend should use this for pagination

    try {
      set((s) => ({
        roomBuckets: {
          ...s.roomBuckets,
          [roomId]: { ...bucket, isLoading: true },
        },
      }));

      const res = await fetch(url.toString(), { method: "GET" });
      if (!res.ok) throw new Error("Failed to load older messages");

      const data = await res.json();
      const rows = Array.isArray(data.messages) ? data.messages : [];

      const transformed = rows.map(transformApiMessage);
      const sorted = transformed.sort(
        (a: Imessage, b: Imessage) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      

      // prepend older ones
      const merged = mergeBucketMessages(sorted, bucket.messages);

      const nextBucket: RoomBucket = {
        messages: merged,
        hasMore: sorted.length >= LIMIT_MESSAGE,
        isLoading: false,
        initialized: true,
        oldestCreatedAt: merged[0]?.created_at ?? bucket.oldestCreatedAt,
      };

      set((s) => ({
        roomBuckets: {
          ...s.roomBuckets,
          [roomId]: nextBucket,
        },
        messages:
          s.activeRoomId === roomId ? nextBucket.messages : s.messages,
        hasMore:
          s.activeRoomId === roomId ? nextBucket.hasMore : s.hasMore,
      }));
    } catch (err) {
      console.error("loadMoreMessages error:", err);
      toast.error("Failed to load older messages");
      set((s) => ({
        roomBuckets: {
          ...s.roomBuckets,
          [roomId]: { ...bucket, isLoading: false },
        },
      }));
    }
  },

  // ---------------------------
  // Realtime subscription
  // ---------------------------
  subscribeToRoom: (roomId?: string, directChatId?: string) =>
    set((state) => {
      const supabase = getSupabaseBrowserClient();

      if (state.currentSubscription) {
        supabase.removeChannel(state.currentSubscription);
      }

      if (!roomId && !directChatId) {
        return { currentSubscription: null };
      }

      const filter = roomId
        ? `room_id=eq.${roomId}`
        : `direct_chat_id=eq.${directChatId}`;

      const channelName = roomId
        ? `room:${roomId}`
        : `direct_chat:${directChatId}`;

      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter,
          },
          async (payload) => {
            const { data, error } = await supabase
              .from("messages")
              .select(
                `
                *,
                profiles!messages_sender_id_fkey (
                  id, username, display_name, avatar_url, bio, created_at, updated_at
                )
              `
              )
              .eq("id", payload.new.id)
              .single();

            if (error || !data) return;

            get().addMessage(transformApiMessage(data));
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter,
          },
          (
            payload: RealtimePostgresUpdatePayload<{
              [key: string]: any;
            }>
          ) => {
            const updated = payload.new as Database["public"]["Tables"]["messages"]["Row"];
            get().optimisticUpdateMessage(updated.id, updated);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter,
          },
          (
            payload: RealtimePostgresDeletePayload<{
              [key: string]: any;
            }>
          ) => {
            const deleted = payload.old as Database["public"]["Tables"]["messages"]["Row"];
            get().optimisticDeleteMessage(deleted.id);
          }
        )
        .subscribe();

      return { currentSubscription: channel };
    }),

  unsubscribeFromRoom: () =>
    set((state) => {
      const supabase = getSupabaseBrowserClient();
      if (state.currentSubscription) {
        supabase.removeChannel(state.currentSubscription);
      }
      return { currentSubscription: null };
    }),

  // ---------------------------
  // Search (unchanged)
  // ---------------------------
  searchMessages: async (roomId, query) => {
    if (!query.trim()) return [];

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("messages")
      .select(
        `
        *,
        profiles!messages_sender_id_fkey (
          id, display_name, avatar_url, username
        )
      `
      )
      .eq("room_id", roomId)
      .ilike("text", `%${query}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error(error);
      toast.error("Message search failed");
      return [];
    }

    return (data || []).map(transformApiMessage) as Imessage[];
  },
}));
