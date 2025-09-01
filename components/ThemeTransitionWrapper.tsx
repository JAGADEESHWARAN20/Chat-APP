"use client";

import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { useState, createContext, useContext } from "react";

interface ThemeTransitionContextValue {
  triggerTransition: (x: number, y: number, nextTheme: string) => void;
  isDark: boolean;
}

const ThemeTransitionContext = createContext<ThemeTransitionContextValue | null>(
  null
);

export function useThemeTransition() {
  const ctx = useContext(ThemeTransitionContext);
  if (!ctx) throw new Error("useThemeTransition must be used inside ThemeTransitionWrapper");
  return ctx;
}

export default function ThemeTransitionWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const [circle, setCircle] = useState<{
    x: number;
    y: number;
    active: boolean;
    nextTheme: string;
  }>({
    x: 0,
    y: 0,
    active: false,
    nextTheme: "light",
  });

  const triggerTransition = (x: number, y: number, nextTheme: string) => {
    setCircle({ x, y, active: true, nextTheme });

    setTimeout(() => {
      setTimeout(() => {
        setCircle((prev) => ({ ...prev, active: false }));
        setTheme(nextTheme);
      }, 500);
    }, 90);
  };

  return (
    <ThemeTransitionContext.Provider value={{ triggerTransition, isDark }}>
      {children}

      <AnimatePresence>
        {circle.active && (
          <motion.div
            initial={{ clipPath: `circle(0% at ${circle.x}px ${circle.y}px)` }}
            animate={{ clipPath: `circle(150% at ${circle.x}px ${circle.y}px)` }}
            exit={{ opacity: 0 }}
            transition={{ duration: .4, ease: "linear" }}
            className="fixed inset-0 z-[99999] pointer-events-none"
            style={{
              background:
                circle.nextTheme === "dark"
                  ? "hsl(224 71.4% 4.1%)"
                  : "hsl(0 0% 100%)",
              color:
                circle.nextTheme === "dark"
                  ? "hsl(210 40% 98%)"
                  : "hsl(224 71.4% 4.1%)",
              // Add border effect (like circular ring)
              boxShadow:
                circle.nextTheme === "dark"
                  ? "0 0 0 4px hsl(210 40% 98%)"
                  : "0 0 0 4px hsl(224 71.4% 4.1%)",
              mixBlendMode: circle.nextTheme === "dark"
                  ? "overlay"
                  : "difference", 
            }}
          />
        )}
      </AnimatePresence>
    </ThemeTransitionContext.Provider>
  );
}
