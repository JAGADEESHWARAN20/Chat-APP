import { create } from "zustand";
import { LIMIT_MESSAGE } from "../constant";
import { Database } from "@/lib/types/supabase";

// Derive Imessage type from Database
export type Imessage = Database["public"]["Tables"]["messages"]["Row"] & {
	users: Database["public"]["Tables"]["users"]["Row"] | null;
};

// Zustand state and actions
interface MessageState {
	hasMore: boolean;
	page: number;
	messages: Imessage[];
	actionMessage: Imessage | undefined;
	optimisticIds: string[];
	addMessage: (message: Imessage) => void;
	setActionMessage: (message: Imessage | undefined) => void;
	optimisticDeleteMessage: (messageId: string) => void;
	optimisticUpdateMessage: (messageId: string, updates: Partial<Imessage>) => void;
	addOptimisticId: (id: string) => void;
	setMessages: (messages: Imessage[]) => void;
	clearMessages: () => void;
	setOptimisticIds: (id: string) => void;
}

export const useMessage = create<MessageState>()((set) => ({
	hasMore: true,
	page: 1,
	messages: [],
	optimisticIds: [],
	actionMessage: undefined,

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


	setOptimisticIds: (id) =>
		set((state) => ({
			optimisticIds: [...state.optimisticIds, id],
		})),

	addOptimisticId: (id: string) =>
		set((state) => ({
			optimisticIds: [...state.optimisticIds, id],
		})),

	addMessage: (newMessage) =>
		set((state) => {
			const exists = state.messages.some((msg) => msg.id === newMessage.id);
			if (exists) return { messages: state.messages };
			return { messages: [...state.messages, newMessage] };
		}),

	setActionMessage: (message) => set(() => ({ actionMessage: message })),

	optimisticDeleteMessage: (messageId) =>
		set((state) => ({
			messages: state.messages.filter((message) => message.id !== messageId),
		})),

	optimisticUpdateMessage: (messageId, updates) =>
		set((state) => ({
			messages: state.messages.map((message) =>
				message.id === messageId ? { ...message, ...updates } : message
			),
		})),

	clearMessages: () =>
		set(() => ({
			messages: [],
			page: 1,
			hasMore: true,
		})),
}));