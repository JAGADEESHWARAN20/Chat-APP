import { User } from "@supabase/supabase-js";
import { create } from "zustand";
import { LIMIT_MESSAGE } from "../constant";

export interface Imessage {
	id: string;
	text: string;
	send_by: string;
	room_id: string | null;
	direct_chat_id?: string | null;
	dm_thread_id?: string | null;
	is_edit: boolean;
	created_at: string;
	status: string | null; // Updated to match database schema
	users: {
		id: string;
		avatar_url: string;
		display_name: string;
		username: string;
		created_at: string;
	} | null;
}

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
	setOptimisticIds: (id: string) => void;
	setMessages: (messages: Imessage[]) => void;
}

export const useMessage = create<MessageState>()((set) => ({
	hasMore: true,
	page: 1,
	messages: [],
	optimisticIds: [],
	actionMessage: undefined,
	setMessages: (messages) =>
		set((state) => ({
			messages: [...messages, ...state.messages],
			page: state.page + 1,
			hasMore: messages.length >= LIMIT_MESSAGE,
		})),
	setOptimisticIds: (id: string) =>
		set((state) => ({ optimisticIds: [...state.optimisticIds, id] })),
	addMessage: (newMessage) =>
		set((state) => ({
			messages: [...state.messages, newMessage],
		})),
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
}));