"use client";

import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { useState, createContext, useContext } from "react";

interface ThemeTransitionContextValue {
  triggerTransition: (x: number, y: number, nextTheme: string) => void;
  isDark: boolean;
}

const ThemeTransitionContext = createContext<ThemeTransitionContextValue | null>(null);

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

  const [transitionState, setTransitionState] = useState<{
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
    setTransitionState({ x, y, active: true, nextTheme });

    setTimeout(() => {
      setTransitionState(prev => ({ ...prev, active: false }));
      setTheme(nextTheme);
    }, 800);
  };

  return (
    <ThemeTransitionContext.Provider value={{ triggerTransition, isDark }}>
      <div className={`transition-colors duration-500 ${theme}`}>
        {children}
      </div>

      {/* Liquid Morph Overlay */}
      <AnimatePresence>
        {transitionState.active && (
          <motion.div
            className="fixed inset-0 z-[99999] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Liquid Blob */}
            <motion.div
              className="absolute rounded-full"
              style={{
                background: transitionState.nextTheme === "dark" 
                  ? "radial-gradient(circle, hsl(224 71.4% 4.1%) 0%, hsl(224 71.4% 4.1%) 100%)"
                  : "radial-gradient(circle, hsl(0 0% 100%) 0%, hsl(0 0% 100%) 100%)",
                mixBlendMode: transitionState.nextTheme === "dark" ? "difference" : "screen",
                left: transitionState.x,
                top: transitionState.y,
              }}
              initial={{
                width: 0,
                height: 0,
                x: "-50%",
                y: "-50%",
                scale: 0,
              }}
              animate={{
                width: "300vmax",
                height: "300vmax",
                scale: 1,
              }}
              exit={{
                scale: 1.2,
                opacity: 0,
              }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 200,
                duration: 0.8,
              }}
            />
            
            {/* Ripple Waves */}
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="absolute rounded-full border"
                style={{
                  borderColor: transitionState.nextTheme === "dark" ? "hsl(224 71.4% 4.1%)" : "hsl(0 0% 100%)",
                  left: transitionState.x,
                  top: transitionState.y,
                }}
                initial={{
                  width: 0,
                  height: 0,
                  x: "-50%",
                  y: "-50%",
                  opacity: 0.8,
                }}
                animate={{
                  width: "100vmax",
                  height: "100vmax",
                  opacity: 0,
                }}
                transition={{
                  delay: i * 0.15,
                  duration: 1.2,
                  ease: "easeOut",
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </ThemeTransitionContext.Provider>
  );
}