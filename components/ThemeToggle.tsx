"use client";

import React, { useRef } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { useThemeTransition } from "@/components/ThemeTransitionWrapper";
import type { Theme } from "@/lib/utils/theme";

export default function ThemeToggleButton() {
  const { triggerTransition, isDark, isTransitioning } = useThemeTransition();
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const handleClick = () => {
    if (isTransitioning) return;

    const nextTheme: Theme = isDark ? "light" : "dark";

    // Prefer exact center of button and account for page scroll
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const cx = Math.round(rect.left + rect.width / 2 + (window.scrollX || 0));
      const cy = Math.round(rect.top + rect.height / 2 + (window.scrollY || 0));
      triggerTransition(cx, cy, nextTheme);
    } else {
      // Fallback: center of viewport (in px)
      const cx = Math.round(window.innerWidth / 2 + (window.scrollX || 0));
      const cy = Math.round(window.innerHeight / 2 + (window.scrollY || 0));
      triggerTransition(cx, cy, nextTheme);
    }
  };

  return (
    <div
      className="
        flex items-center gap-1.2em
        p-[0.35em] rounded-[1.4em]
        bg-[hsl(var(--background))/0.8]
        backdrop-blur-xl
        border border-[hsl(var(--border))/0.3]
        shadow-inner
        select-none
      "
      style={{ fontSize: "0.9em" }}
    >
      {/* label */}
      <motion.span
        key={isDark ? "dark" : "light"}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="text-sm font-medium text-[hsl(var(--foreground))] flex items-center gap-1"
      >
        <Monitor className="w-[0.9em] h-[0.9em]" />
        {isDark ? "Dark" : "Light"}
      </motion.span>

      {/* main button */}
      <Button
        ref={btnRef}
        onClick={handleClick}
        disabled={isTransitioning}
        aria-pressed={isDark}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        className="
          relative
          w-[2.6em] h-[2.6em]
          rounded-full overflow-hidden
          group
          active:scale-95
          transition-transform duration-200
          border border-[hsl(var(--border))/0.2]
          shadow-lg
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        style={{
          // use CSS variables only; gradient uses var-based colors so ThemeTransitionWrapper can change them
          background: `linear-gradient(145deg, hsl(var(--action-active) / 1), hsl(var(--primary) / 1))`,
        }}
      >
        {/* icon morph */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isDark ? "sun" : "moon"}
            initial={{ opacity: 0, scale: 0.8, rotate: -20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotate: 20 }}
            transition={{ duration: 0.28, ease: "easeInOut" }}
            className="flex items-center justify-center w-full h-full"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-[hsl(var(--foreground))]" />
            ) : (
              <Moon className="w-4 h-4 text-[hsl(var(--foreground))]" />
            )}
          </motion.div>
        </AnimatePresence>

        {/* inner ripple (local effect on button) */}
        <AnimatePresence>
          {isTransitioning && (
            <motion.span
              className="absolute inset-0 rounded-full pointer-events-none"
              initial={{ scale: 0, opacity: 0.6 }}
              animate={{ scale: 2.6, opacity: 0 }}
              exit={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              style={{
                // rely on CSS vars for color; use subtle overlay so new theme is visible under the expanding background mask
                background:
                  isDark
                    ? "radial-gradient(circle, hsl(var(--popover-foreground) / 0.25) 0%, transparent 70%)"
                    : "radial-gradient(circle, hsl(var(--popover) / 0.18) 0%, transparent 70%)",
              }}
            />
          )}
        </AnimatePresence>
      </Button>
    </div>
  );
}
