"use client";

import { create } from "zustand";
import { LIMIT_MESSAGE } from "../constant";
import { Database } from "@/lib/types/supabase";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { RealtimePostgresInsertPayload, RealtimePostgresUpdatePayload, RealtimePostgresDeletePayload } from '@supabase/supabase-js';

export type MessageWithProfile = Database["public"]["Tables"]["messages"]["Row"] & {
  profiles: Database["public"]["Tables"]["profiles"]["Row"];
};

export type Imessage = MessageWithProfile;

type ActionMessage = Imessage | null;
type ActionType = "edit" | "delete" | null;

interface MessageState {
  hasMore: boolean;
  page: number;
  messages: Imessage[];
  actionMessage: ActionMessage;
  actionType: ActionType;
  optimisticIds: string[];
  currentSubscription: ReturnType<
    ReturnType<typeof getSupabaseBrowserClient>["channel"]
  > | null;

  addMessage: (message: Imessage) => void;
  setMessages: (messages: Imessage[]) => void;
  clearMessages: () => void;
  setOptimisticIds: (id: string) => void;

  setActionMessage: (message: Imessage, type: ActionType) => void;
  resetActionMessage: () => void;

  optimisticDeleteMessage: (messageId: string) => void;
  optimisticUpdateMessage: (messageId: string, updates: Partial<Imessage>) => void;

  subscribeToRoom: (roomId?: string, directChatId?: string) => void;
  unsubscribeFromRoom: () => void;
  searchMessages: (roomId: string, query: string) => Promise<Imessage[]>;
}

export const useMessage = create<MessageState>()((set, get) => ({
  hasMore: true,
  page: 1,
  messages: [],
  optimisticIds: [],
  actionMessage: null,
  actionType: null,
  currentSubscription: null,

  setMessages: (newMessages) =>
    set((state) => {
      const existingIds = new Set(state.messages.map((msg) => msg.id));
      const filtered = newMessages.filter((msg) => !existingIds.has(msg.id));
      return {
        messages: [...filtered, ...state.messages],
        page: state.page + 1,
        hasMore: newMessages.length >= LIMIT_MESSAGE,
      };
    }),

  addMessage: (message) =>
    set((state) => {
      if (state.messages.some((msg) => msg.id === message.id)) return state;
      return { messages: [message, ...state.messages] };
    }),

  setOptimisticIds: (id) =>
    set((state) => ({
      optimisticIds: [...state.optimisticIds, id],
    })),

  setActionMessage: (message, type) => set({ actionMessage: message, actionType: type }),
  resetActionMessage: () => set({ actionMessage: null, actionType: null }),

  optimisticDeleteMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== messageId),
    })),

  optimisticUpdateMessage: (messageId, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      ),
    })),

  clearMessages: () =>
    set(() => ({
      messages: [],
      page: 1,
      hasMore: true,
    })),

  // ✅ Fixed: Proper type handling for real-time subscriptions
  subscribeToRoom: (roomId?: string, directChatId?: string) =>
    set((state) => {
      const supabase = getSupabaseBrowserClient();

      // Unsubscribe previous channel
      if (state.currentSubscription) supabase.removeChannel(state.currentSubscription);

      if (!roomId && !directChatId) return { currentSubscription: null };

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
          { event: "INSERT", schema: "public", table: "messages", filter },
          async (payload: RealtimePostgresInsertPayload<{ [key: string]: any }>) => {
            const newMessage = payload.new as Database["public"]["Tables"]["messages"]["Row"];

            // ✅ Fixed: Use proper join syntax for the relationship
            const { data: messageWithUser, error } = await supabase
              .from("messages")
              .select(`
                *,
                profiles!messages_sender_id_fkey (
                  id, display_name, avatar_url, username, bio, created_at, updated_at
                )
              `)
              .eq("id", newMessage.id)
              .single();

            if (error) {
              console.error(error);
              toast.error("Failed to load message details");
              return;
            }

            if (messageWithUser && !get().optimisticIds.includes(messageWithUser.id)) {
              get().addMessage(messageWithUser as Imessage);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages", filter },
          (payload: RealtimePostgresUpdatePayload<{ [key: string]: any }>) => {
            const updatedMessage = payload.new as Database["public"]["Tables"]["messages"]["Row"];
            get().optimisticUpdateMessage(updatedMessage.id, updatedMessage);
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "messages", filter },
          (payload: RealtimePostgresDeletePayload<{ [key: string]: any }>) => {
            const deletedMessage = payload.old as Database["public"]["Tables"]["messages"]["Row"];
            get().optimisticDeleteMessage(deletedMessage.id);
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

  // ✅ Fixed: Proper type handling for search results
  searchMessages: async (roomId, query) => {
    if (!query.trim()) return [];

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("messages")
      .select(`
        *,
        profiles!messages_sender_id_fkey (
          id, display_name, avatar_url, username
        )
      `)
      .eq("room_id", roomId)
      .ilike("text", `%${query}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      toast.error("Message search failed");
      console.error(error);
      return [];
    }

    // Proper type assertion
    return (data || []) as Imessage[];
  },
}));