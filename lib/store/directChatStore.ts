import { create } from 'zustand';
import { User } from '@supabase/supabase-js';

interface DirectChat {
    id: string;
    user_id_1: string;
    user_id_2: string;
    created_at: string;
}

interface DirectChatState {
    selectedChat: DirectChat | null;
    selectedUser: User | null;
    setSelectedChat: (chat: DirectChat | null) => void;
    setSelectedUser: (user: User | null) => void;
}

export const useDirectChatStore = create<DirectChatState>((set) => ({
    selectedChat: null,
    selectedUser: null,
    setSelectedChat: (chat) => set({ selectedChat: chat }),
    setSelectedUser: (user) => set({ selectedUser: user })
}));