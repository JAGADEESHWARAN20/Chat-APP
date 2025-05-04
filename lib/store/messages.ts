import { create } from "zustand";
import { LIMIT_MESSAGE } from "../constant";

// Message type
export interface Imessage {
	id: string;
	text: string;
	send_by: string;
	room_id: string | null;
	direct_chat_id?: string | null;
	dm_thread_id?: string | null;
	is_edit: boolean;
	created_at: string;
	status: string | null;
	users: {
		id: string;
		avatar_url: string;
		display_name: string;
		username: string;
		created_at: string;
	} | null;
}

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
}

export const useMessage = create<MessageState>()((set) => ({
	hasMore: true,
	page: 1,
	messages: [],
	optimisticIds: [],
	actionMessage: undefined,

	setMessages: (newMessages) =>
		set((state) => ({
			messages: [...newMessages, ...state.messages],
			page: state.page + 1,
			hasMore: newMessages.length >= LIMIT_MESSAGE,
		})),

	addOptimisticId: (id: string) =>
		set((state) => ({
			optimisticIds: [...state.optimisticIds, id],
		})),

	addMessage: (newMessage) =>
		set((state) => {
			const exists = state.messages.some((msg) => msg.id === newMessage.id);
			return exists
				? { messages: state.messages }
				: { messages: [...state.messages, newMessage] };
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
