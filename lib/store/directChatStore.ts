import { create } from 'zustand';
import { User } from '@supabase/supabase-js';

export interface DirectChat {
  id: string;
  user_id_1: string;
  user_id_2: string;
  created_at: string | null;
  initiator_id: string;
  interest_status: string | null;
}

export interface DirectChatSummary extends DirectChat {
  unread_count: number;
  latest_message: string | null;
  latest_message_created_at: string | null;
  other_user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface DirectChatState {
  selectedChat: DirectChatSummary | null;
  selectedUser: User | null;
  chats: DirectChatSummary[];
  setChats: (chats: DirectChatSummary[]) => void;
  upsertChat: (chat: DirectChatSummary) => void;
  setSelectedChat: (chat: DirectChatSummary | null) => void;
  setSelectedUser: (user: User | null) => void;
}

export const useDirectChatStore = create<DirectChatState>((set) => ({
  selectedChat: null,
  selectedUser: null,
  chats: [],
  setChats: (chats) => set({ chats }),
  upsertChat: (chat) =>
    set((state) => {
      const existingIndex = state.chats.findIndex((item) => item.id === chat.id);
      if (existingIndex === -1) {
        return { chats: [chat, ...state.chats] };
      }

      const next = [...state.chats];
      next[existingIndex] = chat;
      return { chats: next };
    }),
  setSelectedChat: (chat) => set({ selectedChat: chat }),
  setSelectedUser: (user) => set({ selectedUser: user }),
}));
