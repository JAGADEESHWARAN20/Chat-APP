// lib/store/user.ts
import { create } from "zustand";
import { supabaseBrowser } from "@/lib/supabase/browser";

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
  authUser: any | null;        // raw Supabase auth user
  profile: ProfileRow | null;  // row from profiles table
  setUser: (authUser: any) => Promise<void>;
  clearUser: () => void;
};

export const useUser = create<UserState>((set) => ({
  authUser: null,
  profile: null,

  setUser: async (authUser) => {
    if (!authUser) {
      set({ authUser: null, profile: null });
      return;
    }

    const supabase = supabaseBrowser();

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();

    set({ authUser, profile });
  },

  clearUser: () => set({ authUser: null, profile: null }),
}));
