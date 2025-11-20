// components/ThemeTransitionWrapper.tsx
"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { setTheme, readInitialTheme, type Theme } from "@/lib/utils/theme";

interface ThemeTransitionContextType {
  triggerTransition: (x: number, y: number, theme: Theme) => void;
  isDark: boolean;
  isTransitioning: boolean;
}

const ThemeTransitionContext = createContext<ThemeTransitionContextType | undefined>(undefined);

export function useThemeTransition() {
  const ctx = useContext(ThemeTransitionContext);
  if (!ctx) {
    throw new Error("useThemeTransition must be used within ThemeTransitionWrapper");
  }
  return ctx;
}

export function ThemeTransitionWrapper({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // circle origin + radius
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const radiusRef = useRef<number>(0);

  // previous theme background color for the mask
  const maskColorRef = useRef<string | null>(null);
  const prevThemeRef = useRef<Theme>("light");

  // animation config
  const ANIM_DURATION_MS = 600; // total mask animation length (ms)
  const THEME_APPLY_DELAY = Math.round(ANIM_DURATION_MS / 2); // apply theme at halfway

  // init theme from storage / system (no immediate UI flash)
  useEffect(() => {
    const initial = readInitialTheme();
    prevThemeRef.current = initial;
    setIsDark(initial === "dark");
    // DO NOT call setTheme here if you want ThemeTransitionWrapper to be the single place that toggles theme.
    // However we need the page initial theme consistent — calling setTheme ensures variables are set initially.
    setTheme(initial);
  }, []);

  function computeFarCornerRadius(cx: number, cy: number) {
    if (typeof window === "undefined") return 0;
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    const d1 = Math.hypot(cx - 0, cy - 0);
    const d2 = Math.hypot(cx - vw, cy - 0);
    const d3 = Math.hypot(cx - 0, cy - vh);
    const d4 = Math.hypot(cx - vw, cy - vh);
    return Math.ceil(Math.max(d1, d2, d3, d4) + 12); // small padding
  }

  /**
   * Called by ThemeToggleButton.
   * x, y are viewport coordinates (clientX / button center).
   */
  const triggerTransition = (x: number, y: number, theme: Theme) => {
    if (typeof window === "undefined") return;

    // capture PREVIOUS background color (so mask can use it while expanding)
    try {
      const cs = getComputedStyle(document.documentElement);
      const bgVar = cs.getPropertyValue("--background").trim();
      if (bgVar) {
        // --background is expected as "H S L" in your CSS config
        const parts = bgVar.split(/\s+/);
        if (parts.length >= 3) {
          maskColorRef.current = `hsl(${bgVar})`;
        } else {
          // fallback to computed backgroundColor
          maskColorRef.current = cs.backgroundColor || "hsl(var(--background))";
        }
      } else {
        maskColorRef.current = cs.backgroundColor || "hsl(var(--background))";
      }
    } catch {
      maskColorRef.current = "hsl(var(--background))";
    }

    // compute origin + radius
    const cx = Math.round(x);
    const cy = Math.round(y);
    const radius = computeFarCornerRadius(cx, cy);
    originRef.current = { x: cx, y: cy };
    radiusRef.current = radius;

    // start animation
    setIsTransitioning(true);

    // Apply theme after a short delay (halfway through) to avoid flash.
    window.setTimeout(() => {
      prevThemeRef.current = theme;
      setIsDark(theme === "dark");
      // Apply theme where it matters (this will update CSS variables / body/class)
      setTheme(theme);
    }, THEME_APPLY_DELAY);

    // cleanup after animation completes
    window.setTimeout(() => {
      setIsTransitioning(false);
      originRef.current = null;
      maskColorRef.current = null;
    }, ANIM_DURATION_MS + 60);
  };

  return (
    <ThemeTransitionContext.Provider value={{ triggerTransition, isDark, isTransitioning }}>
      <div className="relative" style={{ "--z-mask": "0" } as React.CSSProperties}>
        <AnimatePresence>
          {isTransitioning && originRef.current && (
            <motion.div
              key="theme-mask-expand"
              // mask is fixed and pointer-events-none
              className="fixed inset-0 pointer-events-none"
              // z-index pulled from CSS var so you can set `--z-mask` in your globals if you want it above UI
              style={
                {
                  zIndex: "var(--z-mask, 0)",
                  background: maskColorRef.current ?? "hsl(var(--background))",
                  // to keep TS happy we place vendor prefixed property inside style, not inside motion animate/initial
                  WebkitClipPath: `circle(0px at ${originRef.current.x}px ${originRef.current.y}px)`,
                } as React.CSSProperties
              }
              initial={{
                // motion uses standard property clipPath
                clipPath: `circle(0px at ${originRef.current.x}px ${originRef.current.y}px)`,
                opacity: 1,
              }}
              animate={{
                clipPath: `circle(${radiusRef.current}px at ${originRef.current.x}px ${originRef.current.y}px)`,
                opacity: 1,
              }}
              exit={{
                clipPath: `circle(${radiusRef.current}px at ${originRef.current.x}px ${originRef.current.y}px)`,
                opacity: 0,
              }}
              transition={{ duration: ANIM_DURATION_MS / 1000, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        {/* app content (sidebar + homepage + everything) */}
        <div className="relative">{children}</div>
      </div>
    </ThemeTransitionContext.Provider>
  );
}
