// useMessage.tsx
import { create } from "zustand";
import { LIMIT_MESSAGE } from "../constant";
import { Database } from "@/lib/types/supabase";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";

type MessageWithProfile = Database["public"]["Tables"]["messages"]["Row"] & {
  profiles: Database["public"]["Tables"]["profiles"]["Row"];
};

export type Imessage = MessageWithProfile;

type ActionMessage = Imessage | null;
type ActionType = "edit" | "delete" | null; // Define a new type for clarity

interface MessageState {
  hasMore: boolean;
  page: number;
  messages: Imessage[];
  actionMessage: ActionMessage;
  actionType: ActionType; // ✅ Add actionType state
  optimisticIds: string[];
  currentSubscription: any | null;
  addMessage: (message: Imessage) => void;
  setActionMessage: (message: Imessage, type: ActionType) => void; // ✅ Modify setter
  resetActionMessage: () => void; // ✅ Add reset function
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
  actionMessage: null,
  actionType: null, // ✅ Initialize
  currentSubscription: null,

  setMessages: (newMessages) =>
    set((state) => {
      const existingIds = new Set(state.messages.map((msg) => msg.id));
      const filteredNew = newMessages.filter((msg) => !existingIds.has(msg.id));
      return {
        messages: [...filteredNew, ...state.messages],
        page: state.page + 1,
        hasMore: newMessages.length >= LIMIT_MESSAGE,
      };
    }),

  addMessage: (message) =>
    set((state) => {
      const existingMessage = state.messages.find((msg) => msg.id === message.id);
      if (existingMessage) return state;
      return {
        messages: [message, ...state.messages],
      };
    }),

  setOptimisticIds: (id) =>
    set((state) => ({
      optimisticIds: [...state.optimisticIds, id],
    })),

  setActionMessage: (message, type) => set({ actionMessage: message, actionType: type }), // ✅ Update setter
  resetActionMessage: () => set({ actionMessage: null, actionType: null }), // ✅ Add reset

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

  subscribeToRoom: (roomId) =>
    set((state) => {
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
            const { data: messageWithUser, error } = await supabaseBrowser()
              .from("messages")
              .select(
                `
                *,
                profiles:profiles!messages_sender_id_fkey (
                  id,
                  display_name,
                  avatar_url,
                  username,
                  bio,
                  created_at,
                  updated_at
                )
              `
              )
              .eq("id", newMessage.id)
              .single<MessageWithProfile>();

            if (error) {
              toast.error("Error fetching message details");
              return;
            }

            if (messageWithUser && !state.optimisticIds.includes(messageWithUser.id)) {
              get().addMessage(messageWithUser as unknown as Imessage);
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
          (payload: { new: Database["public"]["Tables"]["messages"]["Row"] }) => {
            const { new: updatedMessage } = payload;
            get().optimisticUpdateMessage(updatedMessage.id, updatedMessage);
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
            const { old: deletedMessage } = payload;
            get().optimisticDeleteMessage(deletedMessage.id);
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