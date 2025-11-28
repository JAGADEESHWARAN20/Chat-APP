"use client";

import { create } from "zustand";
import { LIMIT_MESSAGE } from "../constant";
import { Database } from "@/lib/types/supabase";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/sonner"
import {  RealtimePostgresUpdatePayload, RealtimePostgresDeletePayload } from '@supabase/supabase-js';

// Add this helper function at the top of your store
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

export type MessageWithProfile = Database["public"]["Tables"]["messages"]["Row"] & {
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
  } | null; // ✅ allow null so optimistic messages don't fallback to email
};


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

  // setMessages: (newMessages) =>
  //   set((state) => {
  //     // Transform API messages to ensure all fields are present
  //     const transformedMessages = newMessages.map(transformApiMessage);
      
  //     const existingIds = new Set(state.messages.map((msg) => msg.id));
  //     const filtered = transformedMessages.filter((msg) => !existingIds.has(msg.id));
      
  //     return {
  //       messages: [...filtered, ...state.messages],
  //       page: state.page + 1,
  //       hasMore: newMessages.length >= LIMIT_MESSAGE,
  //     };
  //   }),
  setMessages: (incoming) =>
    set(() => ({
      messages: incoming.map(transformApiMessage), // ✅ replace, don’t merge
      page: 1,
      hasMore: incoming.length >= LIMIT_MESSAGE,
    })),
  
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
          async (payload) => {
            // ✅ fetch the message WITH profiles (same shape as /api/messages/[roomId])
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