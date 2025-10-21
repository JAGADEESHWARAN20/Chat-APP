"use client";

import { Sun, Moon, Sparkles, Monitor } from "lucide-react";
import { useThemeTransition } from "./ThemeTransitionWrapper";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function ThemeToggleButton() {
  const { triggerTransition, isDark } = useThemeTransition();

  return (
    <div className="flex items-center gap-3 p-2 rounded-2xl bg-gradient-to-r from-slate-100/80 to-slate-200/80 dark:from-slate-800/80 dark:to-slate-900/80 backdrop-blur-xl border border-slate-300/50 dark:border-slate-600/50 shadow-lg">
      <motion.span 
        className="text-sm font-semibold text-slate-700 dark:text-slate-300 min-w-[45px] flex items-center gap-1"
        key={isDark ? "dark" : "light"}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Monitor className="w-3 h-3" />
        {isDark ? "Dark" : "Light"}
      </motion.span>
      
      <Button
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          const nextTheme = isDark ? "light" : "dark";
          triggerTransition(x, y, nextTheme);
        }}
        className="
          relative w-12 h-12 rounded-full
          bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 
          dark:from-indigo-500 dark:via-purple-600 dark:to-violet-700
          shadow-xl hover:shadow-2xl
          transition-all duration-500 ease-out
          hover:scale-110 active:scale-95
          group
          overflow-hidden
        "
      >
        {/* Animated sparkles */}
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={{ rotate: isDark ? 180 : 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          <Sparkles className="absolute top-1 left-1 w-2 h-2 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <Sparkles className="absolute bottom-1 right-1 w-2 h-2 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </motion.div>

        {/* Morphing icon */}
        <motion.div
          className="relative w-5 h-5"
          initial={false}
          animate={{ rotate: isDark ? 180 : 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          <Sun className="absolute inset-0 w-full h-full text-white" />
          <Moon className="absolute inset-0 w-full h-full text-white" />
        </motion.div>

        {/* Pulse effect */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-white/30"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Glow effect */}
        <div className={`
          absolute inset-0 rounded-full
          transition-all duration-500
          ${isDark 
            ? 'bg-purple-400/20 blur-md' 
            : 'bg-amber-400/20 blur-md'
          }
          opacity-0 group-hover:opacity-100
        `} />
      </Button>
    </div>
  );
}