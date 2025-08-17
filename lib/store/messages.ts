import { create } from "zustand";
import { LIMIT_MESSAGE } from "../constant";
import { Database } from "@/lib/types/supabase";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { RealtimeChannel } from "@supabase/supabase-js";

// Derive Imessage type from Database
export type Imessage = Database["public"]["Tables"]["messages"]["Row"] & {
  profiles: Database["public"]["Tables"]["profiles"]["Row"] | null;
};

// Zustand state and actions
interface MessageState {
  hasMore: boolean;
  page: number;
  messages: Imessage[];
  actionMessage: Imessage | undefined;
  optimisticIds: string[];
  currentSubscription: RealtimeChannel | null;
  addMessage: (message: Imessage) => void;
  setActionMessage: (message: Imessage | undefined) => void;
  optimisticDeleteMessage: (messageId: string) => void;
  optimisticUpdateMessage: (messageId: string, updates: Partial<Imessage>) => void;
  addOptimisticId: (id: string) => void;
  setMessages: (messages: Imessage[]) => void;
  clearMessages: () => void;
  setOptimisticIds: (id: string) => void;
  subscribeToRoom: (roomId: string) => void;
  unsubscribeFromRoom: () => void;
}

export const useMessage = create<MessageState>()((set, get) => ({
  hasMore: true,
  page: 1,
  messages: [],
  optimisticIds: [],
  actionMessage: undefined,
  currentSubscription: null,

  // --- REFACTOR: setMessages now handles pagination logic
  setMessages: (newMessages) =>
    set((state) => {
      // Sort the new messages to ensure they are in chronological order
      const sortedNewMessages = [...newMessages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      return {
        messages: sortedNewMessages,
        page: state.page + 1,
        hasMore: newMessages.length === LIMIT_MESSAGE,
      };
    }),

  addMessage: (message) =>
    set((state) => {
      const existingMessage = state.messages.find((msg) => msg.id === message.id);
      if (existingMessage) return state;

      // Add the new message to the end of the array to maintain correct order
      return {
        messages: [...state.messages, message],
      };
    }),

  setOptimisticIds: (id) =>
    set((state) => ({
      optimisticIds: [...state.optimisticIds, id],
    })),

  setActionMessage: (message) =>
    set(() => ({
      actionMessage: message,
    })),

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

  addOptimisticId: (id) =>
    set((state) => ({
      optimisticIds: [...state.optimisticIds, id],
    })),

  clearMessages: () =>
    set(() => ({
      messages: [],
      page: 1,
      hasMore: true,
    })),

  // --- REFACTOR: Subscription logic is simplified and now fetches joined data
  subscribeToRoom: (roomId) =>
    set((state) => {
      // Clean up existing subscription if any
      if (state.currentSubscription) {
        state.currentSubscription.unsubscribe();
      }

      const subscription = supabaseBrowser()
        .channel(`room:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `room_id=eq.${roomId}`,
          },
          async (payload: { new: Database["public"]["Tables"]["messages"]["Row"] }) => {
            const { new: newMessage } = payload;
            
            // Check if the message is already in our optimistic state
            if (get().optimisticIds.includes(newMessage.id)) {
              return;
            }

            // Fetch the complete message data with the associated user profile
            const { data: messageWithUser, error } = await supabaseBrowser()
              .from("messages")
              .select(
                `*,
                profiles:profiles!sender_id (
                  id, display_name, avatar_url, username, bio, created_at, updated_at
                )`
              )
              .eq("id", newMessage.id)
              .single();

            if (error) {
              toast.error("Error fetching message details");
              console.error(error);
              return;
            }

            // Add the new message to the state
            if (messageWithUser) {
              get().addMessage(messageWithUser as Imessage);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            get().optimisticUpdateMessage(payload.new.id, payload.new as Partial<Imessage>);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            get().optimisticDeleteMessage(payload.old.id);
          }
        )
        .subscribe();

      return {
        currentSubscription: subscription,
      };
    }),

  unsubscribeFromRoom: () =>
    set((state) => {
      if (state.currentSubscription) {
        state.currentSubscription.unsubscribe();
      }
      return {
        currentSubscription: null,
      };
    }),
}));