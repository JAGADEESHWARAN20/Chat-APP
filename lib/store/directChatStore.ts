import { create } from "zustand";
import { Database } from "@/lib/types/supabase";

type UserProfile = Database["public"]["Tables"]["users"]["Row"];

export interface DirectChat {
    id: string;
    other_user_id: string;
    users: UserProfile;
}

interface DirectChatState {
    selectedChat: DirectChat | null;
    setSelectedChat: (chat: DirectChat | null) => void;
}

export const useDirectChatStore = create<DirectChatState>((set) => ({
    selectedChat: null,
    setSelectedChat: (chat) => set({ selectedChat: chat }),
}));