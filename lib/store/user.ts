import { create } from "zustand";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type UserState = {
  authUser: any | null;
  profile: ProfileRow | null;
  user: any | null; // 👈 computed
  setUser: (authUser: any) => Promise<void>;
  clearUser: () => void;
};

export const useUser = create<UserState>((set, get) => ({
  authUser: null,
  profile: null,
  user: null,

  setUser: async (authUser) => {
    if (!authUser) {
      set({ authUser: null, profile: null, user: null });
      return;
    }

    const supabase = getSupabaseBrowserClient();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (error) {
      console.error("Profile fetch error:", error);
    }

    set({ authUser, profile, user: { ...authUser, profile } }); // 👈 expose combined object
  },

  clearUser: () => set({ authUser: null, profile: null, user: null }),
}));