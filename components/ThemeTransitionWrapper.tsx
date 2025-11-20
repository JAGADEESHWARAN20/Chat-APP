"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ThemeTransitionContextType {
  triggerTransition: (x: number, y: number, theme: 'light' | 'dark') => void;
  isDark: boolean;
  isTransitioning: boolean;
}

const ThemeTransitionContext = createContext<ThemeTransitionContextType | undefined>(undefined);

export function useThemeTransition() {
  const context = useContext(ThemeTransitionContext);
  if (!context) {
    throw new Error('useThemeTransition must be used within a ThemeTransitionWrapper');
  }
  return context;
}

interface ThemeTransitionWrapperProps {
  children: React.ReactNode;
}

export function ThemeTransitionWrapper({ children }: ThemeTransitionWrapperProps) {
  const [isDark, setIsDark] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionOrigin, setTransitionOrigin] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Check system preference or stored theme
    const storedTheme = localStorage.getItem('theme');
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (storedTheme === 'dark' || (!storedTheme && systemIsDark)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const triggerTransition = (x: number, y: number, theme: 'light' | 'dark') => {
    setTransitionOrigin({ x, y });
    setIsTransitioning(true);

    // Apply theme immediately for better performance
    setTimeout(() => {
      setIsDark(theme === 'dark');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('theme', theme);
    }, 300); // Faster transition

    // Reset transitioning state
    setTimeout(() => {
      setIsTransitioning(false);
    }, 800);
  };

  return (
    <ThemeTransitionContext.Provider value={{ triggerTransition, isDark, isTransitioning }}>
      <div className="relative">
        {/* Simple Overlay without color inversion */}
        <AnimatePresence>
          {isTransitioning && (
            <motion.div
              className="absolute inset-0 z-[9999] pointer-events-none"
              initial={{ 
                clipPath: `circle(0px at ${transitionOrigin.x}px ${transitionOrigin.y}px)`,
                backgroundColor: isDark ? 'hsl(0 0% 100% / 0.1)' : 'hsl(224 71.4% 4.1% / 0.1)'
              }}
              animate={{ 
                clipPath: `circle(150vh at ${transitionOrigin.x}px ${transitionOrigin.y}px)`,
              }}
              exit={{ 
                clipPath: `circle(150vh at ${transitionOrigin.x}px ${transitionOrigin.y}px)`,
              }}
              transition={{ 
                duration: 0.3,
                ease: "easeOut"
              }}
            />
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </ThemeTransitionContext.Provider>
  );
}