import { create } from "zustand";
import { Database } from "@/lib/types/supabase";

type UserProfile = Database["public"]["Tables"]["profiles"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];

export interface RecentAction {
     id: string;
     type: "room" | "direct";
     name: string;
     lastMessage: string;
     timestamp: string;
}

interface RecentActionsState {
     recentActions: RecentAction[];
     activityItems: Array<(Room & { isMember: boolean }) | UserProfile>;
     setRecentActions: (actions: RecentAction[]) => void;
     setActivityItems: (items: Array<(Room & { isMember: boolean }) | UserProfile>) => void;
}

export const useRecentActions = create<RecentActionsState>((set) => ({
     recentActions: [],
     activityItems: [],
     setRecentActions: (actions) => set({ recentActions: actions }),
     setActivityItems: (items) => set({ activityItems: items }),
}));