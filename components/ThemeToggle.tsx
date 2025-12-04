

// components/ThemeToggleButton.tsx
"use client";

import React, { useRef } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { useThemeTransition } from "@/components/ThemeTransitionWrapper";
import type { Theme } from "@/lib/utils/theme";

export default function ThemeToggleButton() {
  const { triggerTransition, isDark, isTransitioning } = useThemeTransition();
  const btnRef = useRef<HTMLButtonElement>(null);
  
  // CSS Variables from your global CSS
  const themeStyles = {
    // Colors
    sidebarBackground: 'hsl(var(--sidebar-background))',
    sidebarForeground: 'hsl(var(--sidebar-foreground))',
    sidebarPrimary: 'hsl(var(--sidebar-primary))',
    
    // Effects
    glassOpacity: 'var(--glass-opacity, 0.6)',
    glassBlur: 'var(--glass-blur, 32px)',
    borderOpacity: 'var(--border-opacity, 0.1)',
    
    // Animation
    transitionDuration: 'var(--motion-duration, 200ms)',
    transitionEasing: 'var(--motion-easing, cubic-bezier(0.4, 0, 0.2, 1))',
  };

  const handleClick = () => {
    if (isTransitioning) return;

    const nextTheme: Theme = isDark ? "light" : "dark";

    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      triggerTransition(cx, cy, nextTheme);
    } else {
      triggerTransition(window.innerWidth / 2, window.innerHeight / 2, nextTheme);
    }
  };

  return (
    <div className="flex items-center gap-4 pl-[1.3em] select-none">
      {/* Elegant Label */}
      <motion.div
        key={isDark ? "dark" : "light"}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="text-xs font-medium uppercase tracking-widest opacity-70 flex items-center gap-2"
        style={{ color: themeStyles.sidebarForeground }}
      >
        <Monitor 
          style={{
            width: `calc(${themeStyles.transitionDuration} * 2)`,
            height: `calc(${themeStyles.transitionDuration} * 2)`,
          }}
        />
        {isDark ? "Dark" : "Light"}
      </motion.div>

      {/* Premium Toggle Button */}
      <Button
        ref={btnRef}
        onClick={handleClick}
        disabled={isTransitioning}
        className="
          relative group p-0 overflow-hidden
          backdrop-blur-2xl
          active:scale-[1.2]
          transition-all
        "
        style={{
          width: '4rem', // 64px
          height: '4rem',
          borderRadius: 'calc(var(--radius-unit, 0.5rem) * 1.5)',
          border: `1px solid hsl(0 0% 100% / ${themeStyles.borderOpacity})`,
          backgroundColor: `${themeStyles.sidebarBackground} / ${themeStyles.glassOpacity}`,
          backdropFilter: `blur(${themeStyles.glassBlur})`,
          boxShadow: `
            0 8px 32px ${themeStyles.sidebarPrimary} / 0.2,
            inset 0 1px 0 hsl(0 0% 100% / 0.1),
            inset 0 -1px 0 hsl(0 0% 0% / 0.15)
          `,
          transitionDuration: themeStyles.transitionDuration,
          transitionTimingFunction: themeStyles.transitionEasing,
        }}
      >
        {/* Subtle Inner Glow Orb */}
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <div
            className="absolute inset-0 rounded-2xl blur-2xl"
            style={{
              background: isDark
                ? "radial-gradient(circle at 30% 30%, hsl(240 90% 70% / 0.4), transparent 70%)"
                : "radial-gradient(circle at 70% 70%, hsl(48 100% 67% / 0.5), transparent 70%)",
            }}
          />
        </div>

        {/* 3D Flip Icon — Immediate */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isDark ? "moon" : "sun"}
            initial={{ rotateY: 180, opacity: 0, scale: 1 }}
            animate={{ rotateY: 0, opacity: 1, scale: 1 }}
            exit={{ rotateY: -180, opacity: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }} // Faster animation
            className="relative z-10 flex items-center justify-center w-full h-full"
          >
            {isDark ? (
              // MOON — Dark Mode
              <Sun
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  strokeWidth: '2.2',
                  color: themeStyles.sidebarForeground,
                  filter: "drop-shadow(0 0 20px hsl(48 100% 67% / 0.7))",
                }}
              />
            ) : (
              // SUN — Light Mode
              <Moon
                style={{
                  width: '2.25rem',
                  height: '2.25rem',
                  strokeWidth: '2',
                  color: themeStyles.sidebarForeground,
                  filter: "drop-shadow(0 0 16px hsl(240 90% 70% / 0.6))",
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Expanding Ripple on Theme Change */}
        <AnimatePresence>
          {isTransitioning && (
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 6, opacity: 0 }}
              transition={{ duration: 0.8, ease: "circOut" }} // Faster ripple
              style={{
                background: isDark
                  ? "radial-gradient(circle, hsl(48 100% 67% / 0.4), transparent 65%)"
                  : "radial-gradient(circle, hsl(240 90% 70% / 0.5), transparent 65%)",
              }}
            />
          )}
        </AnimatePresence>

        {/* Hover Shimmer Shine */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(110deg, transparent 30%, hsl(0 0% 100% / 0.12) 50%, transparent 70%)",
              transform: "translateX(-200%)",
              animation: "shimmer 2s infinite", // Faster shimmer
            }}
          />
        </div>
      </Button>
    </div>
  );
}