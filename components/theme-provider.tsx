"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";
import { motion, AnimatePresence } from "framer-motion";

type ThemeTransitionContextProps = {
  startTransition: (x: number, y: number) => void;
};

const ThemeTransitionContext = React.createContext<ThemeTransitionContextProps | null>(null);

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [coords, setCoords] = React.useState<{ x: number; y: number } | null>(null);
  const [animating, setAnimating] = React.useState(false);
  const { theme, setTheme } = useTheme();

  const startTransition = (x: number, y: number) => {
    setCoords({ x, y });
    setAnimating(true);
    setTheme(theme === "light" ? "dark" : "light");
    setTimeout(() => setAnimating(false), 600); // cleanup after animation
  };

  return (
    <NextThemesProvider {...props}>
      <ThemeTransitionContext.Provider value={{ startTransition }}>
        {children}

        {/* Circular reveal overlay */}
        <AnimatePresence>
          {animating && coords && (
            <motion.div
              key="theme-reveal"
              className="fixed inset-0 pointer-events-none z-[9999]"
              initial={{ clipPath: `circle(0px at ${coords.x}px ${coords.y}px)` }}
              animate={{ clipPath: `circle(150% at ${coords.x}px ${coords.y}px)` }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            >
              {/* This layer forces background + text color rebind */}
              <div className="w-full h-full bg-background text-foreground" />
            </motion.div>
          )}
        </AnimatePresence>
      </ThemeTransitionContext.Provider>
    </NextThemesProvider>
  );
}

// Hook for child components (toggle button, etc.)
export const useThemeTransition = () => {
  const ctx = React.useContext(ThemeTransitionContext);
  if (!ctx) throw new Error("useThemeTransition must be used inside ThemeProvider");
  return ctx;
};
