"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useThemeTransition } from "./ThemeTransitionWrapper";
import { Button } from "@/components/ui/button";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

export default function ThemeToggleButton() {
  const { triggerTransition, isDark } = useThemeTransition();
  const ref = useRef<HTMLButtonElement>(null);

  // 3D tilt animation
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-20, 20], [10, -10]);
  const rotateY = useTransform(x, [-20, 20], [-10, 10]);
  const smoothX = useSpring(rotateX, { stiffness: 100, damping: 15 });
  const smoothY = useSpring(rotateY, { stiffness: 100, damping: 15 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;
    x.set(offsetX);
    y.set(offsetY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div className="flex items-center gap-3 p-1.5 rounded-2xl bg-gradient-to-r from-slate-100/80 to-slate-200/80 dark:from-slate-800/80 dark:to-slate-900/80 backdrop-blur-xl border border-slate-300/40 dark:border-slate-700/40 shadow-inner">
      {/* Theme Label */}
      <motion.span
        key={isDark ? "dark" : "light"}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1"
      >
        <Monitor className="w-3 h-3" />
        {isDark ? "Dark" : "Light"}
      </motion.span>

      {/* Main Button */}
      <motion.div style={{ rotateX: smoothX, rotateY: smoothY }}>
        <Button
          ref={ref}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const nextTheme = isDark ? "light" : "dark";
            triggerTransition(cx, cy, nextTheme);
          }}
          className="relative w-10 h-10 rounded-full overflow-hidden group active:scale-95 transition-all duration-300 border border-white/10 shadow-[0_0_8px_rgba(0,0,0,0.15)]"
          style={{
            background: isDark
              ? "linear-gradient(145deg, hsl(45 95% 55%), hsl(35 90% 45%), hsl(30 90% 40%))"
              : "linear-gradient(145deg, hsl(245 85% 60%), hsl(260 70% 55%), hsl(275 65% 50%))",
          }}
        >
          {/* Icon Morph - Inverted Logic */}
          <motion.div
            key={isDark ? "sun" : "moon"} // ✅ swap icons
            initial={{ opacity: 0, scale: 0.8, rotate: -20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotate: 20 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="flex items-center justify-center"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-yellow-200 drop-shadow-[0_0_8px_rgba(255,220,150,0.9)]" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-200 drop-shadow-[0_0_8px_rgba(180,180,255,0.9)]" />
            )}
          </motion.div>

          {/* Ambient Glow */}
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{
              boxShadow: isDark
                ? [
                    "0 0 10px rgba(251,191,36,0.3)",
                    "0 0 25px rgba(251,191,36,0.6)",
                    "0 0 10px rgba(251,191,36,0.3)",
                  ]
                : [
                    "0 0 10px rgba(139,92,246,0.3)",
                    "0 0 25px rgba(139,92,246,0.6)",
                    "0 0 10px rgba(139,92,246,0.3)",
                  ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Soft Reflection Light */}
          <motion.div
            className="absolute top-0 left-0 w-full h-full rounded-full opacity-30 mix-blend-overlay"
            animate={{
              background: isDark
                ? [
                    "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.3), transparent 70%)",
                    "radial-gradient(circle at 70% 80%, rgba(255,255,255,0.2), transparent 70%)",
                  ]
                : [
                    "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4), transparent 70%)",
                    "radial-gradient(circle at 70% 80%, rgba(255,255,255,0.25), transparent 70%)",
                  ],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        </Button>
      </motion.div>
    </div>
  );
}
