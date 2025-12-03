// lib/store/usePreferencesStore.ts
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FontFamilyMode = "default" | "modern" | "rounded" | "mono";
export type LayoutDensity = "compact" | "comfortable" | "spacious";

interface PreferencesState {
  // typography
  appFontScale: number;              // global multiplier (0.8 - 1.4)
  chatFontScale: number;
  sidebarFontScale: number;
  headerFontScale: number;

  fontMode: FontFamilyMode;

  // layout
  density: LayoutDensity;

  // actions
  setAppFontScale: (v: number) => void;
  setChatFontScale: (v: number) => void;
  setSidebarFontScale: (v: number) => void;
  setHeaderFontScale: (v: number) => void;

  setFontMode: (mode: FontFamilyMode) => void;
  setDensity: (density: LayoutDensity) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      appFontScale: 1,
      chatFontScale: 1,
      sidebarFontScale: 1,
      headerFontScale: 1,

      fontMode: "default",
      density: "comfortable",

      setAppFontScale: (v) => set({ appFontScale: v }),
      setChatFontScale: (v) => set({ chatFontScale: v }),
      setSidebarFontScale: (v) => set({ sidebarFontScale: v }),
      setHeaderFontScale: (v) => set({ headerFontScale: v }),

      setFontMode: (mode) => set({ fontMode: mode }),
      setDensity: (d) => set({ density: d }),
    }),
    { name: "flychat-preferences" }
  )
);
