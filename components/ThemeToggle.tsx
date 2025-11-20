"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useThemeTransition } from "./ThemeTransitionWrapper";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { useRef } from "react";

export default function ThemeToggleButton() {
  const { triggerTransition, isDark, isTransitioning } = useThemeTransition();
  const ref = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    if (isTransitioning) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const nextTheme = isDark ? "light" : "dark";
    triggerTransition(cx, cy, nextTheme);
  };

  return (
    <div className="flex items-center gap-3 p-1.5 rounded-2xl bg-gradient-to-r from-slate-100/80 to-slate-200/80 dark:from-slate-800/80 dark:to-slate-900/80 backdrop-blur-xl border border-slate-300/40 dark:border-slate-700/40 shadow-inner">
      {/* Theme Label */}
      <motion.span
        key={isDark ? "dark" : "light"}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1"
      >
        <Monitor className="w-3 h-3" />
        {isDark ? "Dark" : "Light"}
      </motion.span>

      {/* Main Button */}
      <Button
        ref={ref}
        onClick={handleClick}
        disabled={isTransitioning}
        className="relative w-10 h-10 rounded-full overflow-hidden group active:scale-95 transition-all duration-200 border border-white/10 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: isDark
            ? "linear-gradient(145deg, hsl(45 95% 55%), hsl(35 90% 45%))"
            : "linear-gradient(145deg, hsl(245 85% 60%), hsl(260 70% 55%))",
        }}
      >
        {/* Icon Morph */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isDark ? "sun" : "moon"}
            initial={{ opacity: 0, scale: 0.8, rotate: -20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotate: 20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex items-center justify-center"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-yellow-200" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-200" />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Transition Ripple */}
        <AnimatePresence>
          {isTransitioning && (
            <motion.div
              className="absolute inset-0 rounded-full"
              initial={{ scale: 0, opacity: 0.6 }}
              animate={{ scale: 2, opacity: 0 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{
                background: isDark
                  ? "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(0,0,0,0.3) 0%, transparent 70%)"
              }}
            />
          )}
        </AnimatePresence>
      </Button>
    </div>
  );
}