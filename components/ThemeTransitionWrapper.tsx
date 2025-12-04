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
  
  // Store the actual theme for immediate UI updates
  const currentThemeRef = useRef<Theme>("light");

  // circle origin + radius
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const radiusRef = useRef<number>(0);

  // animation config - FASTER
  const ANIM_DURATION_MS = 400; // Reduced from 600ms
  const THEME_APPLY_DELAY = Math.round(ANIM_DURATION_MS / 4); // Apply theme much earlier

  // init theme from storage / system
  useEffect(() => {
    const initial = readInitialTheme();
    currentThemeRef.current = initial;
    setIsDark(initial === "dark");
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
    return Math.ceil(Math.max(d1, d2, d3, d4) + 8); // Reduced padding
  }

  /**
   * IMMEDIATE theme switching with smooth visual transition
   */
  const triggerTransition = (x: number, y: number, theme: Theme) => {
    if (typeof window === "undefined" || isTransitioning) return;

    // Compute animation values FIRST
    const cx = Math.round(x);
    const cy = Math.round(y);
    const radius = computeFarCornerRadius(cx, cy);
    originRef.current = { x: cx, y: cy };
    radiusRef.current = radius;

    // IMMEDIATELY update theme state and UI
    setIsTransitioning(true);
    currentThemeRef.current = theme;
    setIsDark(theme === "dark");
    
    // IMMEDIATELY apply theme (no delay)
    setTheme(theme);

    // Start animation
    window.setTimeout(() => {
      setIsTransitioning(false);
      originRef.current = null;
    }, ANIM_DURATION_MS);
  };

  return (
    <ThemeTransitionContext.Provider value={{ triggerTransition, isDark, isTransitioning }}>
      <div className="relative" style={{ "--z-mask": "0" } as React.CSSProperties}>
        <AnimatePresence>
          {isTransitioning && originRef.current && (
            <motion.div
              key="theme-mask-expand"
              className="fixed inset-0 pointer-events-none"
              style={
                {
                  zIndex: "var(--z-mask, 0)",
                  backgroundColor: "transparent",
                  WebkitClipPath: `circle(0px at ${originRef.current.x}px ${originRef.current.y}px)`,
                } as React.CSSProperties
              }
              initial={{
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
              transition={{ 
                duration: ANIM_DURATION_MS / 1000, 
                ease: [0.4, 0, 0.2, 1], // Faster easing curve
              }}
            />
          )}
        </AnimatePresence>

        {/* app content */}
        <div className="relative">{children}</div>
      </div>
    </ThemeTransitionContext.Provider>
  );
}
